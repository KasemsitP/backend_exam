// src/Service/gradingscore.service.ts
import { DB } from "../model/DB";
import gradingscoreRepo, { DbGradingScoreRow } from "../Repo/gradingscore.repo";
import { gradingRecheckService } from "./gradingrecheck.service";



export interface SubmitScorePayload {
  qrPayload?: string;
  campaignId: number;
  slotId: number;
  graderId: number;
  score: number;
}


export interface GradingScoreResult {
  gradingscoreId: number;
  slotId: number;
  score: number;
  status: string;
  enteredAt: Date;
  graderId: number;
  graderName: string;
}

export class gradingScoreService {
  /**
   * บันทึกคะแนนของ slot หนึ่ง
   * 1) verify slot context (campaign/session/subject/question/grader)
   * 2) insert grading_scores
   * 3) update grading_slots.status = 'COMPLETED'
   * 4) select ข้อมูลกลับมาในรูป GradingScoreResult
   */
static async submitScore(
  payload: SubmitScorePayload
): Promise<GradingScoreResult> {
  const { campaignId, slotId, graderId, score } = payload;

  const conn = await DB.getInstance().getConnection();

  try {
    await conn.beginTransaction();

    // 1) ตรวจว่า slot นี้เป็นของ campaign นี้ + grader นี้จริงไหม
    const isValidSlot = await gradingscoreRepo.verifySlotContext(conn, {
      slotId,
      campaignId,
      graderId,
    });

    if (!isValidSlot) {
      throw new Error(
        "slot ไม่ตรงกับ campaign หรือไม่ได้ถูกมอบหมายให้ผู้ตรวจคนนี้"
      );
    }

    // 2) insert grading_scores
    const gradingScoreId = await gradingscoreRepo.insertScore(
      conn,
      slotId,
      score,
      graderId
    );

    // 3) update slot status
    await gradingscoreRepo.updateSlotStatus(conn, slotId, "COMPLETED");

     await gradingRecheckService.checkAndMarkDisputedIfNeeded(conn, slotId, 4);

    // 4) select ข้อมูลคะแนนที่เพิ่ง insert
    const row = await gradingscoreRepo.findScoreById(conn, gradingScoreId);
    if (!row) {
      throw new Error("ไม่พบข้อมูลคะแนนที่เพิ่งบันทึก");
    }

    await conn.commit();

    const result: GradingScoreResult = {
      gradingscoreId: row.gradingscoreId,
      slotId: row.slotId,
      score: Number(row.score),
      status: row.status,
      enteredAt: row.enteredAt,
      graderId: row.graderId,
      graderName: row.graderName,
    };

    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
}
