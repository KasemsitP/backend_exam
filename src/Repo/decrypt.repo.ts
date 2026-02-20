import { PoolConnection, RowDataPacket } from "mysql2/promise";

interface CampaignUnlockRow extends RowDataPacket {
  id: number;
  is_unlock: number;
}

interface SlotMatrixRow extends RowDataPacket {
  session_id: number;
  subject_id: number;
  booklet_count: number;
  question_count: number;
  expected_slots: number;
  actual_slots: number;
  assigned_slots: number;
  completed_slots: number;
  disputed_slots: number;
  ss_question_count: number;
  mismatch_question_count: number; // 0/1
}
type UnlockIssueCode =
  | "NO_KEYS"
  | "NOT_ENOUGH_KEYS"
  | "NO_IMPORT"
  | "MISSING_SEAT"
  | "UNBAGGED"
  | "SLOT_MISSING"
  | "SLOT_NOT_COMPLETED"
  | "QUESTION_COUNT_MISMATCH";

interface SlotCoverageRow extends RowDataPacket {
  session_id: number;
  subject_id: number;
  booklet_count: number;
  question_count: number;            // from subject_questions
  expected_slots: number;
  actual_slots: number;
  assigned_slots: number;
  completed_slots: number;
  disputed_slots: number;
  ss_question_count: number;
  mismatch_question_count: number;   // 0/1
}

export interface UnlockPrereqResult {
  ok: boolean;
  issues: { code: UnlockIssueCode; message: string; meta?: any }[];
  counts: {
    keyCount: number;
    ucCount: number;
    missingSeat: number;
    pendingSlots: number;
    unbagged: number;

    missingSlotsTotal: number;
    notCompletedTotal: number;
    mismatchCountTotal: number;
  };
  details: {
    slotCoverage: SlotCoverageRow[];
  };
}


class DecryptRepo {
  async checkUnlockPrerequisites(
    campaignId: number,
    conn: PoolConnection
  ): Promise<UnlockPrereqResult> {
    const [[{ key_count }]] = await conn.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS key_count
       FROM campaign_keys
       WHERE campaign_id = ? AND active = 1`,
      [campaignId]
    );

    const [[{ uc_count }]] = await conn.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS uc_count
       FROM user_campaigns
       WHERE campaign_id = ?`,
      [campaignId]
    );

    const [[{ missing_seat }]] = await conn.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS missing_seat
       FROM user_campaigns
       WHERE campaign_id = ?
         AND (room_code IS NULL OR row_no IS NULL OR col_no IS NULL)`,
      [campaignId]
    );

    const [[{ pending_slots }]] = await conn.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS pending_slots
       FROM grading_slots gs
       JOIN booklets b ON b.id = gs.booklet_id
       JOIN sessions s ON s.id = b.session_id
       WHERE s.campaign_id = ?
         AND gs.status IN ('OPEN','ASSIGNED','DISPUTED')`,
      [campaignId]
    );

    const [[{ unbagged }]] = await conn.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS unbagged
       FROM booklets b
       JOIN sessions s ON s.id = b.session_id
       WHERE s.campaign_id = ?
         AND b.bag_id IS NULL`,
      [campaignId]
    );

    // ---- slot coverage (expected vs actual) ----
    const slotCoverageSql = `
WITH booklets_in_campaign AS (
  SELECT b.id AS booklet_id, b.session_id
  FROM booklets b
  JOIN user_sessions us ON us.id = b.user_session_id
  WHERE us.campaign_id = ?
),

booklet_counts AS (
  SELECT session_id, COUNT(*) AS booklet_count
  FROM booklets_in_campaign
  GROUP BY session_id
),

question_counts AS (
  SELECT
    ss.session_id,
    ss.subject_id,

    -- ✅ ยึด subject_questions ก่อน ถ้ามี, ถ้าไม่มีค่อยใช้ ss.question_count
    COALESCE(
      NULLIF(COUNT(DISTINCT sq.question_no), 0),
      ss.question_count
    ) AS question_count_effective,

    -- เอาไว้ตรวจ mismatch เฉย ๆ
    COUNT(DISTINCT sq.question_no) AS question_count_sq,
    ss.question_count AS question_count_ss,

    (COUNT(DISTINCT sq.question_no) <> ss.question_count) AS mismatch_question_count
  FROM session_subjects ss
  JOIN sessions se ON se.id = ss.session_id
  LEFT JOIN subject_questions sq
    ON sq.subject_id = ss.subject_id
  WHERE se.campaign_id = ?
  GROUP BY ss.session_id, ss.subject_id, ss.question_count
),

expected AS (
  SELECT
    qc.session_id,
    qc.subject_id,
    bc.booklet_count,
    qc.question_count_effective AS question_count,
    (bc.booklet_count * qc.question_count_effective * 2) AS expected_slots,

    qc.question_count_sq,
    qc.question_count_ss,
    qc.mismatch_question_count
  FROM question_counts qc
  JOIN booklet_counts bc ON bc.session_id = qc.session_id
),

actual AS (
  SELECT
    bic.session_id,
    gs.subject_id,
    COUNT(*) AS actual_slots,
    SUM(gs.grader_id IS NOT NULL) AS assigned_slots,
    SUM(gs.status = 'COMPLETED') AS completed_slots,
    SUM(gs.status = 'DISPUTED') AS disputed_slots,
    SUM(gs.status IN ('OPEN','ASSIGNED','DISPUTED')) AS pending_slots
  FROM grading_slots gs
  JOIN booklets_in_campaign bic ON bic.booklet_id = gs.booklet_id
  WHERE gs.grader_order IN (1,2)
  GROUP BY bic.session_id, gs.subject_id
)

SELECT
  e.session_id,
  e.subject_id,
  e.booklet_count,
  e.question_count,
  e.expected_slots,

  COALESCE(a.actual_slots,0)     AS actual_slots,
  COALESCE(a.assigned_slots,0)   AS assigned_slots,
  COALESCE(a.completed_slots,0)  AS completed_slots,
  COALESCE(a.disputed_slots,0)   AS disputed_slots,
  COALESCE(a.pending_slots,0)    AS pending_slots,

  -- ✅ สรุป “ขาด slot” ชัด ๆ
  GREATEST(e.expected_slots - COALESCE(a.actual_slots,0), 0) AS missing_slots,

  -- ✅ เอาไว้ debug mismatch
  e.question_count_sq,
  e.question_count_ss,
  e.mismatch_question_count

FROM expected e
LEFT JOIN actual a
  ON a.session_id = e.session_id
 AND a.subject_id = e.subject_id
ORDER BY e.session_id, e.subject_id;

    `;

    const [slotCoverage] = await conn.query<SlotCoverageRow[]>(
      slotCoverageSql,
      [campaignId , campaignId]
      
    );

    // totals
    let missingSlotsTotal = 0;
    let notCompletedTotal = 0;
    let mismatchCountTotal = 0;

    for (const r of slotCoverage) {
      const miss = Math.max(0, Number(r.expected_slots) - Number(r.actual_slots));
      const notDone = Math.max(0, Number(r.expected_slots) - Number(r.completed_slots));
      missingSlotsTotal += miss;
      notCompletedTotal += notDone;
      if (Number(r.mismatch_question_count) === 1) mismatchCountTotal += 1;
    }

    // build issues list (เรียงความสำคัญ)
    const issues: UnlockPrereqResult["issues"] = [];

    const keyCount = Number(key_count);
    const ucCount = Number(uc_count);
    const missingSeat = Number(missing_seat);
    const pendingSlots = Number(pending_slots);
    const unbaggedCount = Number(unbagged);

    if (keyCount === 0) {
      issues.push({ code: "NO_KEYS", message: "ยังไม่ได้สร้างคีย์สำหรับแคมเปญนี้" });
    } else if (keyCount < 2) {
      issues.push({ code: "NOT_ENOUGH_KEYS", message: "คีย์ยังไม่ครบ 2 ดอก", meta: { keyCount } });
    }

    if (ucCount === 0) {
      issues.push({ code: "NO_IMPORT", message: "ยังไม่ได้ import ข้อมูลผู้เข้าสอบ (user_campaigns ว่าง)" });
    }

    if (missingSeat > 0) {
      issues.push({ code: "MISSING_SEAT", message: "ยังจัดที่นั่งสอบไม่ครบ", meta: { missingSeat } });
    }

    if (unbaggedCount > 0) {
      issues.push({ code: "UNBAGGED", message: "ยังมีเล่มที่ยังไม่ถูกจัดลงถุง (bag_id is NULL)", meta: { unbagged: unbaggedCount } });
    }

    if (mismatchCountTotal > 0) {
      issues.push({
        code: "QUESTION_COUNT_MISMATCH",
        message: "จำนวนข้อใน session_subjects ไม่ตรงกับ subject_questions",
        meta: { mismatchCountTotal }
      });
    }

    if (missingSlotsTotal > 0) {
      issues.push({
        code: "SLOT_MISSING",
        message: "ระบบยังสร้าง grading slots ไม่ครบตามจำนวนที่ควรมี",
        meta: { missingSlotsTotal }
      });
    }

    // pendingSlots ของคุณคือ OPEN/ASSIGNED/DISPUTED ทั้งหมด -> ถ้ามีคือยังไม่พร้อมปลดล็อก
    if (pendingSlots > 0) {
      issues.push({
        code: "SLOT_NOT_COMPLETED",
        message: "ยังมีช่องตรวจที่ยังไม่เสร็จ (OPEN/ASSIGNED/DISPUTED)",
        meta: { pendingSlots }
      });
    } else if (notCompletedTotal > 0) {
      // เผื่อกรณี status ไม่อยู่ในชุด pending แต่ completed ยังไม่ครบ expected
      issues.push({
        code: "SLOT_NOT_COMPLETED",
        message: "คะแนนยังไม่ครบทุกช่องตาม expected",
        meta: { notCompletedTotal }
      });
    }

    const ok = issues.length === 0;

    return {
      ok,
      issues,
      counts: {
        keyCount,
        ucCount,
        missingSeat,
        pendingSlots,
        unbagged: unbaggedCount,
        missingSlotsTotal,
        notCompletedTotal,
        mismatchCountTotal,
      },
      details: { slotCoverage },
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
