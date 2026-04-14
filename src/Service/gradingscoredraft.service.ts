import { DB } from "../model/DB";
import gradingscoredraftRepo from "../Repo/gradingscoredraft.repo";
import gradingscoreRepo from "../Repo/gradingscore.repo";
import gradingslotRepo from "../Repo/gradingslot.repo";
import { keyService } from "./key.service";

class GradingScoreDraftService {
  static async saveDraftScore(params: {
    slotId: number;
    campaignId: number;
    graderId: number;
    questionNo: number;
    score: number;
  }) {
    const conn = await DB.getInstance().getConnection();
    try {
      await conn.beginTransaction();

      const isValid = await gradingscoredraftRepo.verifySlotContext(conn, {
        slotId: params.slotId,
        campaignId: params.campaignId,
        graderId: params.graderId,
      });

      if (!isValid) {
        throw new Error("slot นี้ไม่อยู่ในสิทธิ์ของผู้ตรวจ หรือไม่อยู่ใน campaign นี้");
      }

      //  ต้องเช็ค lock ก่อน save
      const activeLock = await gradingslotRepo.findActiveLockByGraderId(
        conn,
        params.graderId
      );

      if (!activeLock) {
        throw new Error("ยังไม่ได้เริ่มตรวจ กรุณาสแกนและยืนยันเริ่มตรวจก่อน");
      }

      if (Number(activeLock.question_no) !== Number(params.questionNo)) {
        throw new Error(
          `คุณกำลังตรวจข้อ ${activeLock.question_no} อยู่ กรุณาตรวจข้อนี้ให้เสร็จก่อน`
        );
      }

      const qInfo = await gradingscoredraftRepo.checkScoreInfo(conn, {
        slotId: params.slotId,
        graderId: params.graderId,
        questionNo: params.questionNo,
      });

      if (!qInfo) {
        throw new Error("ไม่พบข้อมูลข้อสอบ");
      }

      if (params.score < 0 || params.score > Number(qInfo.max_score)) {
        throw new Error(`คะแนนต้องอยู่ระหว่าง 0 - ${qInfo.max_score}`);
      }

      const ctx = await gradingscoredraftRepo.findDraftContextBySlotId(
        conn,
        params.slotId
      );

      if (!ctx || !ctx.bagId) {
        throw new Error("ไม่พบ bag ของ slot นี้");
      }

      await gradingscoredraftRepo.upsertDraft(conn, {
        bagId: Number(ctx.bagId),
        bookletId: ctx.bookletId,
        subjectId: ctx.subjectId,
        questionNo: ctx.questionNo,
        slotId: ctx.slotId,
        graderId: ctx.graderId,
        score: params.score,
      });

      // ❌ ห้าม release lock ตรงนี้

      await conn.commit();

      return {
        slotId: ctx.slotId,
        bagId: ctx.bagId,
        bookletId: ctx.bookletId,
        subjectId: ctx.subjectId,
        questionNo: ctx.questionNo,
        score: params.score,
        status: "DRAFT",
      };
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }
  static async getDraftsByBagId(bagId: number) {
    const conn = await DB.getInstance().getConnection();
    try {
      const drafts = await gradingscoredraftRepo.findDraftsByBagId(conn, bagId);
      return drafts;
    } finally {
      conn.release();
    }
  }
  static async getDraftsUnconfirmed(graderId: number) {
    const conn = await DB.getInstance().getConnection();

    try {
      const drafts = await gradingscoredraftRepo.getActiveDraftsByLock(conn, graderId);

      if (!drafts.length) {
        return {
          bag_id: null,
          subject_name: null,
          question_label: null,
          question_no: null,
          drafts: []
        };
      }

      const first = drafts[0];
      console.log("first", first);

      //  เช็ค consistency ทั้งชุด (สำคัญมาก)
      const validRows = drafts.filter(d => d.subject_id !== null && d.question_no !== null);

      const isSameContext = validRows.every(d =>
        d.bag_id === validRows[0].bag_id &&
        d.subject_id === validRows[0].subject_id &&
        d.question_no === validRows[0].question_no
      );

      if (!isSameContext) {
        throw new Error("พบ draft ต่าง context (bag / subject / question) ซึ่งไม่ควรเกิดขึ้น");
      }

      //  mask payload
      const maskPayload = drafts.map(draft => ({
        ...draft,
        payload: draft.payload
          ? keyService.maskQrPayload(draft.payload)
          : null
      }));

      return {
        bag_id: first.bag_id,
        subject_name: validRows[0].subject_name,
        question_label: validRows[0].question_label,
        question_no: validRows[0].question_no,
        drafts: maskPayload
      };

    } finally {
      conn.release();
    }
  }

  static async confirmBagScores(params: {
    bagId: number;
    graderId: number;
    scores: Array<{
      slot_id: number;
      question_no: number;
      score: number;
    }>;
  }) {
    const conn = await DB.getInstance().getConnection();

    try {
      await conn.beginTransaction();

      if (!params.scores.length) {
        throw new Error("ไม่พบคะแนนที่ต้องยืนยัน");
      }

      // 1) ตรวจว่า slot ทั้งหมดอยู่ใน bag นี้ และเป็นของ grader นี้
      const validSlots = await gradingscoredraftRepo.validateSlotsForConfirm(
        conn,
        params.bagId,
        params.graderId,
        params.scores.map((s) => s.slot_id)
      );

      if (!validSlots) {
        throw new Error("พบ slot ที่ไม่ตรงกับถุงหรือไม่ใช่ของผู้ตรวจคนนี้");
      }

      // 2) update draft ตามคะแนนล่าสุดจาก frontend
      for (const item of params.scores) {
        await gradingscoredraftRepo.updateDraftScoreBySlotId(
          conn,
          item.slot_id,
          item.score
        );
      }

      // 3) เช็คว่ามีคะแนนจริงอยู่แล้วไหม
      for (const item of params.scores) {
        const exists = await gradingscoreRepo.existsScoreBySlotId(conn, item.slot_id);
        if (exists) {
          throw new Error(`slot ${item.slot_id} มีคะแนนจริงแล้ว`);
        }
      }
      console.log("params for confirmBagScores", params);
      const rows = await gradingscoredraftRepo.getActiveDraftsByLock(conn, params.graderId);

      console.log("rows for confirmBagScores", rows);

      const missingSlotCount = rows.filter(
        (r) => r.progress_status === "ยังไม่มี slot"
      ).length;

      const missingDraftCount = rows.filter(
        (r) => r.progress_status === "มี slot แต่ยังไม่ตรวจ"
      ).length;

      console.log(`missingSlotCount: ${missingSlotCount}, missingDraftCount: ${missingDraftCount}`);

      if (missingSlotCount > 0 || missingDraftCount > 0) {
        throw new Error(
          `ยังยืนยันไม่ได้ เหลือ ${missingSlotCount + missingDraftCount} ข้อ ` +
          `(ยังไม่มี slot ${missingSlotCount}, มี slot แต่ยังไม่ตรวจ ${missingDraftCount})`
        );
      }

      // 4) insert คะแนนจริงจาก draft
      await gradingscoreRepo.insertScoresFromDraftsByBagIdAndGraderId(
        conn,
        params.bagId,
        params.graderId
      );

      // 5) update slot status
      await gradingslotRepo.markSlotsCompletedByBagIdAndGraderId(
        conn,
        params.bagId,
        params.graderId
      );

      // 6) mark draft confirmed
      await gradingscoredraftRepo.markDraftsConfirmedByBagIdAndGraderId(
        conn,
        params.bagId,
        params.graderId
      );
      await gradingslotRepo.releaseActiveLockByGraderId(
        conn,
        params.graderId
      );
      await conn.commit();


      return {
        bagId: params.bagId,
        graderId: params.graderId,
        totalConfirmed: params.scores.length,
        status: "CONFIRMED",
      };
    } catch (error) {
      console.log("Error in confirmBagScores:", error);
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }
  static async cancelDraftScore(params: { slotId: number }) {
    const conn = await DB.getInstance().getConnection();
    try {
      await conn.beginTransaction();

      const draft = await gradingscoredraftRepo.findDraftBySlotId(conn, params.slotId);

      if (!draft) {
        throw new Error("ไม่พบ draft score ของ slot นี้");
      }

      if (draft.status !== "DRAFT") {
        throw new Error("draft นี้ไม่อยู่ในสถานะที่ยกเลิกได้");
      }

      await gradingscoredraftRepo.cancelDraftBySlotId(conn, params.slotId);

      //  ปล่อย lock ตอน cancel
      await gradingslotRepo.releaseActiveLockByGraderId(
        conn,
        draft.grader_id
      );

      await conn.commit();

      return {
        slotId: params.slotId,
        status: "CANCELLED",
      };
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }
}

export default GradingScoreDraftService;