// src/Service/gradingRecheck.service.ts
import { PoolConnection } from "mysql2/promise";
import { DB } from "../model/DB";
import gradingscoreRepo, {
  DisputedQuestionRow,
} from "../Repo/gradingscore.repo";
import gradingslotRepo from "../Repo/gradingslot.repo";
import { gradingService } from "./gradingslot.service";

interface ScanDisputedFromQrPayload {
  qrPayload: string;
  campaignId: number;
}
interface CreateRecheckSlotFromQrPayload {
  qrPayload: string;
  campaignId: number;
  graderId: number;
  questionNo: number;
}

interface ResetRecheckParams {
  slotId: number;
}

export class gradingRecheckService {

  static async checkAndMarkDisputedIfNeeded(
    conn: PoolConnection,
    slotId: number,
    diffThreshold: number
  ): Promise<void> {
    // 1) เอา context ของ slot นี้ก่อน
    const ctx = await gradingscoreRepo.findSlotContextById(conn, slotId);
    if (!ctx) {
      // ไม่เจอ slot ก็ไม่ทำอะไร
      return;
    }

    // 2) ดึงคะแนนของ "เล่มเดียวกัน + วิชาเดียวกัน + ข้อเดียวกัน" ทุก slot
    const scores = await gradingscoreRepo.findScoresForSlotGroup(
      conn,
      ctx.bookletId,
      ctx.subjectId,
      ctx.questionNo
    );

    // ถ้ายังไม่ครบ 2 คน → ยังไม่ต้องคำนวณ diff
    if (scores.length < 2) return;

    const numericScores = scores.map((s) => Number(s.score));
    const maxScore = Math.max(...numericScores);
    const minScore = Math.min(...numericScores);
    const diff = maxScore - minScore;

    if (diff > diffThreshold) {
      // mark ทุก slot ของข้อนี้เป็น DISPUTED
      for (const row of scores) {
        await gradingscoreRepo.updateSlotStatus(conn, row.slotId, "DISPUTED");
      }
    }
  }

  /**
   * รีเซ็ตคะแนนของข้อหนึ่ง (เล่ม + วิชา + ข้อ) เพื่อ recheck ใหม่
   * - ลบ grading_scores ทั้งหมดของข้อนี้
   * - เซ็ต status ของ slot ทั้งหมดเป็น OPEN
   */
  static async resetQuestionForRecheck(params: { slotId: number, userId: number }) {
    const conn = await DB.getInstance().getConnection();
    try {
      await conn.beginTransaction();

      // 1) หา context จาก slotId
      const ctx = await gradingscoreRepo.findSlotContextById(conn, params.slotId);
      if (!ctx) {
        throw new Error("ไม่พบ slot ที่ต้องการรีเซ็ต");
      }

      // 2) ดึง slot ทั้งคู่ของเล่ม+วิชา+ข้อนี้มาก่อน
      const slots = await gradingslotRepo.findSlotsByBookletAndQuestionAndScore(
        conn,
        ctx.bookletId,
        ctx.subjectId,
        ctx.questionNo,
        false // ไม่ต้อง lock ก็ได้ในจังหวะนี้
      );

      if (!slots.length) {
        throw new Error("ไม่พบ slot ของข้อนี้สำหรับ recheck");
      }

      // 3) อนุญาตให้ reset เฉพาะกรณีที่มีอย่างน้อยหนึ่ง slot เป็น DISPUTED
      const isDisputed = slots.some((s) => s.status === "DISPUTED");
      if (!isDisputed) {
        throw new Error("ข้อนี้ยังไม่ได้ถูก mark ว่า DISPUTED จึงยังไม่เข้าเกณฑ์ recheck");
      }



      console.log("จะรีเซ็ต slotId:", params.slotId, "ของ userId:", params.userId, "ใน context:", ctx, slots);
      // await gradingscoreRepo.InsertLogForRecheck(conn, {
      //   slotId: params.slotId,
      //   userId: params.userId,
      //   bookletId: ctx.bookletId,
      //   subjectId: ctx.subjectId,
      //   questionNo: ctx.questionNo,
      //   slotId1: slots[0].id,
      //   slotId2: slots[1]?.id || 0,
      //   grader1Id: slots[0].grader_id || 0,
      //   grader2Id: slots[1]?.grader_id || 0,
      //   oldScore1: slots[0].score,
      //   oldScore2: slots[1]?.score || 0,
      //   changedBy: params.userId,
      // });

      // 4) ลบคะแนนเดิมทุกคนของข้อเดียวกัน + เล่มเดียวกัน
      await gradingscoreRepo.deleteScoresForQuestion(
        conn,
        ctx.bookletId,
        ctx.subjectId,
        ctx.questionNo
      );

      // 5) เซ็ต status slot ทั้งหมดของข้อนี้กลับเป็น OPEN
      await gradingscoreRepo.resetSlotsStatusForQuestion(
        conn,
        ctx.bookletId,
        ctx.subjectId,
        ctx.questionNo
      );

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

  }

  /**
   * สแกน QR สำหรับ "recheck"
   * ตอนนี้ reuse logic เดิมของ gradingService.createSlotFromQr ตรง ๆ
   * - เพราะเรา reset แล้ว slot เดิมจะ status = OPEN และไม่มี score
   * - เวลา grader สแกน → allocateSlotForQuestion จะเจอ unscoredSlot ของคนเดิม แล้วคืน slotId เดิม
   * ถ้าอยากบังคับว่าใช้ได้เฉพาะ question ที่เคย DISPUTED ก็เพิ่มเงื่อนไขเช็คเพิ่มได้ในอนาคต
   */
  static async createRecheckSlotFromQr(
    payload: CreateRecheckSlotFromQrPayload
  ) {
    // ตรงนี้คือ thin wrapper เฉย ๆ
    return gradingService.createSlotFromQr(payload);
  }

  static async listDisputedQuestions(
    thresholdDiff: number = 4,
    campaign_id: number
  ): Promise<DisputedQuestionRow[]> {
    const conn = await DB.getInstance().getConnection();
    console.log(campaign_id)
    try {
      const rows = await gradingscoreRepo.findDisputedQuestions(
        conn,
        campaign_id,
        thresholdDiff
      );
      return rows;
    } finally {
      conn.release();
    }
  }

  static async EditResetScore(slotId1: number, slotId2: number, score1: number, score2: number, userId: number) {
    const conn = await DB.getInstance().getConnection();
    try {

      const maxScoreRow = await gradingscoreRepo.getMaxScoreforQuestionBySlotId(conn, slotId1);
      const max_score = maxScoreRow ? maxScoreRow.max_score : null;
      if (max_score === null) {
        throw new Error("ไม่พบคะแนนเต็มสำหรับหัวข้อนี้");
      }
      if( Math.abs(score1 - score2) > 4){
        throw new Error(`ความต่างของคะแนนทั้งสอง slot ต้องไม่เกิน 4 คะแนน`);
      }

      if (score1 < 0 || score1 > max_score) {
        throw new Error(`คะแนนต้องอยู่ระหว่าง 0 ถึง ${max_score} สำหรับหัวข้อ ${maxScoreRow?.question_label}`);
      }
      if (score2 < 0 || score2 > max_score) {
        throw new Error(`คะแนนต้องอยู่ระหว่าง 0 ถึง ${max_score} สำหรับหัวข้อ ${maxScoreRow?.question_label}`);
      }

      console.log(userId)

      const ctx = await gradingscoreRepo.findSlotContextById(conn, slotId1);
      if (!ctx) {
        throw new Error("ไม่พบ slot ที่ต้องการรีเซ็ต");
      }

      const slots = await gradingslotRepo.findSlotsByBookletAndQuestionAndScore(
        conn,
        ctx.bookletId,
        ctx.subjectId,
        ctx.questionNo,
        false // ไม่ต้อง lock ก็ได้ในจังหวะนี้
      );

      if (!slots.length) {
        throw new Error("ไม่พบ slot ของข้อนี้สำหรับ recheck");
      }

      const isDisputed = slots.some((s) => s.status === "DISPUTED");
      if (!isDisputed) {
        throw new Error("ข้อนี้ยังไม่ได้ถูก mark ว่า DISPUTED จึงยังไม่เข้าเกณฑ์ recheck");
      }

        await gradingscoreRepo.InsertLogForRecheck(conn, {
        bookletId: ctx.bookletId,
        subjectId: ctx.subjectId,
        questionNo: ctx.questionNo,
        slotId1: slots[0].id,
        slotId2: slots[1]?.id || 0,
        grader1Id: slots[0].grader_id || 0,
        grader2Id: slots[1]?.grader_id || 0,
        oldScore1: slots[0].score,
        oldScore2: slots[1]?.score || 0,
        changedBy: userId
      });

      await gradingscoreRepo.ResetScoreEdit(conn, slotId1, slotId2, score1, score2);

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

  }
}
