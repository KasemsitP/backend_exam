// src/Service/gradingRecheck.service.ts
import { PoolConnection } from "mysql2/promise";
import { DB } from "../model/DB";
import gradingscoreRepo, {
  DisputedQuestionRow,
} from "../Repo/gradingscore.repo";
import gradingslotRepo from "../Repo/gradingslot.repo";
import { gradingService } from "./gradingslot.service";
import { keyService } from "./key.service";

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
  /**
   * ใช้ตอน "บันทึกคะแนน" เพื่อเช็คว่าคะแนน 2 คนต่างกันเกิน threshold มั้ย
   * - ถ้าใช่ → เซ็ต status ของ slot ทั้งคู่เป็น DISPUTED
   * NOTE: ใช้ connection ที่ส่งมาจาก transaction เดิม (ห้าม commit/rollback เอง)
   */
  static async scanDisputedFromQr(payload: ScanDisputedFromQrPayload) {
    const { qrPayload, campaignId } = payload;

    const conn = await DB.getInstance().getConnection();
    try {
      // 1) ถอด QR
      const decoded = await keyService.decryptQrPayload(qrPayload, campaignId);
      const { cid, sid, uid } = decoded; // สมมติ structure เดิม { cid, sid, uid, ... }

      if (cid !== campaignId) {
        throw new Error("QR ไม่ตรงกับแคมเปญที่เลือก");
      }

      // 2) หาเล่มของคนนี้ใน session นี้
      const bookletRow = await gradingslotRepo.findBookletForUser(
        conn,
        campaignId,
        sid,
        uid
      );
      if (!bookletRow) {
        throw new Error("ไม่พบเล่มข้อสอบของผู้เข้าสอบรายนี้ใน session นี้");
      }

      // 3) ดึงทุก slot ที่ DISPUTED ในเล่มนี้
      const disputedSlots = await gradingscoreRepo.findDisputedByBooklet(
        conn,
        bookletRow.booklet_id
      );

      return {
        campaignId,
        sessionId: sid,
        userCode: bookletRow.user_code,
        userId: bookletRow.user_id,
        bookletId: bookletRow.booklet_id,
        hasDispute: disputedSlots.length > 0,
        disputedSlots,
      };
    } finally {
      conn.release();
    }
  }
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

    if (diff >= diffThreshold) {
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
  static async resetQuestionForRecheck(params: { slotId: number }) {
    const conn = await DB.getInstance().getConnection();
    try {
      await conn.beginTransaction();

      // 1) หา context จาก slotId
      const ctx = await gradingscoreRepo.findSlotContextById(conn, params.slotId);
      if (!ctx) {
        throw new Error("ไม่พบ slot ที่ต้องการรีเซ็ต");
      }

      // 2) ดึง slot ทั้งคู่ของเล่ม+วิชา+ข้อนี้มาก่อน
      const slots = await gradingslotRepo.findSlotsByBookletAndQuestion(
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

}
