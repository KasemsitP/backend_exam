import { PoolConnection, RowDataPacket } from "mysql2/promise";

export type UnlockIssueCode =
  | "NO_SCANNED_DATA"
  | "NO_GRADING_SLOTS"
  | "SLOT_MISSING"
  | "GRADING_INCOMPLETE"
  | "SCORE_MISSING";

export interface UnlockPrereqResult {
  ok: boolean;
  issues: { code: UnlockIssueCode; message: string; meta?: any }[];
}

interface CampaignUnlockRow extends RowDataPacket {
  id: number;
  is_unlock: number;
}

class DecryptRepo {
  async checkUnlockPrerequisites(
    campaignId: number,
    conn: PoolConnection
  ): Promise<UnlockPrereqResult> {
    const issues: { code: UnlockIssueCode; message: string; meta?: any }[] = [];

    // 🚀 1. เช็คจำนวนเล่มในถุงทั้งหมดของ Campaign นี้
    const [[{ scanned_booklets }]] = await conn.query<RowDataPacket[]>(
      `SELECT COUNT(b.id) AS scanned_booklets
       FROM booklets b
       JOIN sessions s ON s.id = b.session_id
       WHERE s.campaign_id = ? AND b.bag_id IS NOT NULL`,
      [campaignId]
    );

    if (Number(scanned_booklets) === 0) {
      issues.push({ 
        code: "NO_SCANNED_DATA", 
        message: "ยังไม่มีข้อมูลข้อสอบในระบบ (ยังไม่ได้สแกนข้อสอบลงถุงเลย)" 
      });
      return { ok: false, issues };
    }

    // 🚀 2. คำนวณ Expected Slots ตามสูตร: (จำนวนเล่มในถุง) * (จำนวนข้อ) * 2
    // แยกก้อนนับเล่ม กับ นับข้อสอบ ออกจากกัน แล้วค่อยเอามาคูณกันตรงๆ
    const [[{ expected_total_slots }]] = await conn.query<RowDataPacket[]>(
      `WITH BaggedBooklets AS (
          -- ก้อนที่ 1: นับจำนวนเล่มที่อยู่ในถุง (แยกตามรอบสอบ)
          SELECT b.session_id, COUNT(b.id) AS booklet_count
          FROM booklets b
          JOIN sessions s ON s.id = b.session_id
          WHERE s.campaign_id = ? AND b.bag_id IS NOT NULL
          GROUP BY b.session_id
       ),
       SessionQuestions AS (
          -- ก้อนที่ 2: นับจำนวนข้อสอบในรอบสอบนั้น
          SELECT ss.session_id, COUNT(sq.question_no) AS question_count
          FROM session_subjects ss
          JOIN subject_questions sq ON sq.subject_id = ss.subject_id
          JOIN sessions s ON s.id = ss.session_id
          WHERE s.campaign_id = ?
          GROUP BY ss.session_id
       )
       -- เอามาเข้าสูตร: เล่ม * ข้อ * 2 
       SELECT COALESCE(SUM(bb.booklet_count * sq.question_count * 2), 0) AS expected_total_slots
       FROM BaggedBooklets bb
       JOIN SessionQuestions sq ON sq.session_id = bb.session_id`,
       [campaignId, campaignId]
    );

    // 🚀 3. นับจำนวนช่องตรวจ (Actual Slots) และสถานะที่มีอยู่ในระบบจริงๆ
    const [[slotStats]] = await conn.query<RowDataPacket[]>(
      `SELECT 
         -- นับเฉพาะช่องของกรรมการคนที่ 1 และ 2 (ไม่นับคนที่ 3 เผื่อมีข้อขัดแย้ง)
         SUM(CASE WHEN gs.grader_order IN (1, 2) THEN 1 ELSE 0 END) AS actual_slots,
         
         -- เช็คสถานะช่องตรวจที่ยังไม่เสร็จสิ้น
         SUM(CASE WHEN gs.status IN ('OPEN', 'ASSIGNED', 'DISPUTED') THEN 1 ELSE 0 END) AS pending_slots,
         
         -- เช็คบัคสถานะ (เสร็จแล้วแต่หาคะแนนไม่เจอ)
         SUM(CASE WHEN gs.status = 'COMPLETED' AND gsc.id IS NULL THEN 1 ELSE 0 END) AS missing_score_slots
       FROM grading_slots gs
       JOIN booklets b ON b.id = gs.booklet_id
       JOIN sessions s ON s.id = b.session_id
       LEFT JOIN grading_scores gsc ON gsc.slot_id = gs.id
       WHERE s.campaign_id = ? AND b.bag_id IS NOT NULL`,
      [campaignId]
    );

    const expectedSlots = Number(expected_total_slots);
    const actualSlots = Number(slotStats.actual_slots);
    const pendingSlots = Number(slotStats.pending_slots);
    const missingScoreSlots = Number(slotStats.missing_score_slots);

    // ❌ เคส A: สแกนถุงแล้ว แต่ไม่ได้กด Generate Slots เลย
    if (actualSlots === 0) {
      issues.push({ 
        code: "NO_GRADING_SLOTS", 
        message: "สแกนข้อสอบลงถุงแล้ว แต่ยังไม่ได้สร้างช่องสำหรับตรวจข้อสอบ (Grading Slots)" 
      });
      return { ok: false, issues };
    }

    // ❌ เคส B: เอาสูตรมาเทียบกัน (ถ้า Actual < Expected คือช่องมาไม่ครบ)
    if (actualSlots < expectedSlots) {
       issues.push({
         code: "SLOT_MISSING",
         message: `ระบบยังสร้างช่องตรวจข้อสอบไม่ครบ (ควรมี ${expectedSlots} ช่อง แต่พบเพียง ${actualSlots} ช่อง)`,
         meta: { expectedSlots, actualSlots, missing: expectedSlots - actualSlots }
       });
    }

    // ❌ เคส C: ช่องมาครบแล้ว แต่กรรมการยังตรวจไม่เสร็จ หรือมีข้อขัดแย้งค้างอยู่
    if (pendingSlots > 0) {
      issues.push({ 
        code: "GRADING_INCOMPLETE", 
        message: `การตรวจยังไม่เสร็จสิ้น! (เหลืออีก ${pendingSlots} ช่องที่ยังตรวจไม่ครบ หรือมีข้อขัดแย้ง)`,
        meta: { pendingSlots }
      });
    }

    // ❌ เคส D: ตรวจเสร็จแล้ว แต่คะแนนดันไม่มี (Data Corrupted)
    if (missingScoreSlots > 0) {
      issues.push({
        code: "SCORE_MISSING",
        message: `พบความผิดปกติ: สถานะตรวจเสร็จแล้ว แต่ไม่มีข้อมูลคะแนนจำนวน ${missingScoreSlots} ช่อง`,
        meta: { missingScoreSlots }
      });
    }

    return {
      ok: issues.length === 0,
      issues
    };
  }

  async getCampaignIdUnlock(campaignId: number, conn: PoolConnection): Promise<CampaignUnlockRow | null> {
    const sql = `
      SELECT id, is_unlock
      FROM exam_campaigns
      WHERE id = ?
      FOR UPDATE
    `;
    const [rows] = await conn.query<CampaignUnlockRow[]>(sql, [campaignId]);
    return rows[0] ?? null;
  }
}

const decryptRepo = new DecryptRepo();
export default decryptRepo;