// src/Repo/gradingslot.repo.ts
import { PoolConnection, RowDataPacket, ResultSetHeader } from "mysql2/promise";


export interface BookletLookupRow extends RowDataPacket {
  booklet_id: number;
  user_session_id: number;
  user_campaign_id: number;
  user_id: number;
  user_code: string;
  bag_id : number;
  bag_no : number;
}

export interface GradingSlotRow extends RowDataPacket {
  id: number;
  booklet_id: number;
  subject_id: number;
  question_no: number;
  grader_order: number;
  status: string;
  grader_id: number | null;
}

export interface GradingSlotAndScoreRow extends RowDataPacket {
  id: number;
  booklet_id: number;
  subject_id: number;
  question_no: number;
  grader_order: number;
  status: string;
  grader_id: number | null;
  score: number 
}


class GradingslotRepo {
  /**
   * หา booklet_subject สำหรับผู้เข้าสอบ 1 คน ใน campaign+session+subject ที่กำหนด
   * ใช้จาก decoded QR => {cid, sid, uid} + subjectId
   */
  async findBookletForUser(
    conn: PoolConnection,
    campaignId: number,
    sessionId: number,
    userCode: string
  ): Promise<BookletLookupRow | null> {
    const sql = `
SELECT
    b.id              AS booklet_id,
    b.user_session_id AS user_session_id,
    us.user_campaign_id,
    us.qr_payload,          -- เพิ่มตรงนี้
    u.id              AS user_id,
    u.user_code       AS user_code,
    bg.id              AS bag_id,
    bg.bag_no          AS bag_no
FROM users u
JOIN user_campaigns uc
  ON uc.user_id = u.id
 AND uc.campaign_id = ?
JOIN user_sessions us
  ON us.user_campaign_id = uc.id
 AND us.session_id = ?
 AND us.campaign_id = ?
JOIN booklets b
  ON b.user_session_id = us.id
JOIN bags bg ON bg.id = b.bag_id 
WHERE u.user_code = ?
LIMIT 1;
    `;

    const params = [campaignId, sessionId, campaignId, userCode];

    const [rows] = await conn.execute<BookletLookupRow[]>(sql, params);
    return rows[0] || null;
  }

  /**
   * ดึง slot ทั้งหมดของกระดาษใบนี้ + ข้อนี้
   * ถ้า forUpdate = true จะ FOR UPDATE (ใช้ใน transaction)
   */
  async findSlotsByBookletAndQuestion(
    conn: PoolConnection,
    bookletId: number,
    subjectId: number,
    questionNo: number,
    forUpdate: boolean = false
  ): Promise<GradingSlotRow[]> {
    const sql = `
      SELECT id, booklet_id, subject_id, question_no, grader_order, status, grader_id
      FROM grading_slots
      WHERE booklet_id = ? AND subject_id = ? AND question_no = ?
      ${forUpdate ? "FOR UPDATE" : ""}
    `;
    const [rows] = await conn.execute<GradingSlotRow[]>(sql, [
      bookletId,
      subjectId,
      questionNo,
    ]);
    return rows;
  }

  async findSlotsByBookletAndQuestionAndScore(
    conn: PoolConnection,
    bookletId: number,
    subjectId: number,
    questionNo: number,
    forUpdate: boolean = false
  ): Promise<GradingSlotAndScoreRow[]> {
    const sql = `
SELECT 
  gs.id,
  gs.booklet_id,
  gs.subject_id,
  gs.question_no,
  gs.grader_order,
  gs.status,
  gs.grader_id,
  gsc.score
  
FROM grading_slots gs
LEFT JOIN grading_scores gsc ON gsc.slot_id = gs.id
WHERE gs.booklet_id = ? 
  AND gs.subject_id = ? 
  AND gs.question_no = ?
  ORDER BY grader_order;
      ${forUpdate ? "FOR UPDATE" : ""}
    `;
    const [rows] = await conn.execute<GradingSlotAndScoreRow[]>(sql, [
      bookletId,
      subjectId,
      questionNo,
    ]);
    return rows;
  }

  /**
   * สร้าง slot ใหม่ให้ผู้ตรวจ (status = 'ASSIGNED')
   */
  async insertSlot(
    conn: PoolConnection,
    bookletId: number,
    subjectId: number,
    questionNo: number,
    graderOrder: number,
    graderId: number
  ): Promise<GradingSlotRow> {
    const insertSql = `
      INSERT INTO grading_slots (
        booklet_id,
        subject_id,
        question_no,
        grader_order,
        status,
        grader_id
      )
      VALUES (?, ?, ?, ?, 'ASSIGNED', ?)
    `;
    const [result] = await conn.execute<ResultSetHeader>(insertSql, [
      bookletId,
      subjectId,
      questionNo,
      graderOrder,
      graderId,
    ]);

    const newId = result.insertId;

    const [rows] = await conn.execute<GradingSlotRow[]>(
      `
      SELECT id, booklet_id, subject_id, question_no, grader_order, status, grader_id
      FROM grading_slots
      WHERE id = ?
      `,
      [newId]
    );

    if (!rows[0]) {
      throw new Error("ไม่พบ slot ที่เพิ่งสร้าง");
    }

    return rows[0];
  }





  //ยังไม่มีใช้นะ

  async findAssignmentForGraderInSession(
    conn: PoolConnection,
    graderId: number,
    sessionId: number
  ) {
    const [rows] = await conn.query(
      `
SELECT 
        ga.grader_id,
        ga.session_id,
        ga.subject_id,
        ga.subject_question_id,
        sq.question_no,
        sq.label AS question_label,
        s.name as subject_name
      FROM grader_assignments ga
      JOIN subject_questions sq
        ON ga.subject_question_id = sq.id
      JOIN subjects s ON s.id = sq.subject_id
      WHERE ga.grader_id = ?
        AND ga.session_id = ?;
    `,
      [graderId, sessionId]
    );

    // กรณี 1 grader มีได้แค่ 1 ข้อใน 1 session (ตามที่คุณเลือก)
    return (rows as any[]) ?? null;
  }
  async findUnscoredSlotForGrader(
    conn: PoolConnection,
    bookletId: number,
    subjectId: number,
    questionNo: number,
    graderId: number
  ): Promise<GradingSlotRow | null> {
    const sql = `
      SELECT s.*
      FROM grading_slots s
      LEFT JOIN grading_scores gs
        ON gs.slot_id = s.id
      WHERE s.booklet_id = ?
        AND s.subject_id = ?
        AND s.question_no = ?
        AND s.grader_id  = ?
        AND gs.id IS NULL         -- ยังไม่มีคะแนนเลย
      LIMIT 1
      FOR UPDATE
    `;
    const [rows] = await conn.execute<GradingSlotRow[]>(sql, [
      bookletId,
      subjectId,
      questionNo,
      graderId,
    ]);
    return rows[0] ?? null;
  }
async countExpectedSlotsByBagId(
  conn: PoolConnection,
  bagId: number
): Promise<number> {
  const sql = `
    SELECT COUNT(gs.id) AS total
    FROM booklets b
    JOIN grading_slots gs
      ON gs.booklet_id = b.id
    WHERE b.bag_id = ?
  `;

  const [rows] = await conn.query<RowDataPacket[]>(sql, [bagId]);
  return Number(rows[0]?.total ?? 0);
}
async markSlotsCompletedByBagId(
  conn: PoolConnection,
  bagId: number
): Promise<void> {
  const sql = `
    UPDATE grading_slots gs
    JOIN booklets b
      ON b.id = gs.booklet_id
    JOIN grading_score_drafts gsd
      ON gsd.slot_id = gs.id
    SET gs.status = 'COMPLETED'
    WHERE b.bag_id = ?
      AND gsd.status = 'DRAFT'
  `;

  await conn.query(sql, [bagId]);
}
async validateSlotsForConfirm(
  conn: PoolConnection,
  bagId: number,
  graderId: number,
  slotIds: number[]
): Promise<boolean> {
  if (!slotIds.length) return false;

  const placeholders = slotIds.map(() => "?").join(",");

  const sql = `
    SELECT COUNT(*) AS total
    FROM grading_slots gs
    JOIN booklets bk
      ON bk.id = gs.booklet_id
    WHERE gs.id IN (${placeholders})
      AND gs.grader_id = ?
      AND bk.bag_id = ?
  `;

  const [rows] = await conn.query<RowDataPacket[]>(sql, [
    ...slotIds,
    graderId,
    bagId,
  ]);

  return Number(rows[0]?.total ?? 0) === slotIds.length;
}
async insertScoresFromDraftsByBagIdAndGraderId(
  conn: PoolConnection,
  bagId: number,
  graderId: number
): Promise<void> {
  const sql = `
    INSERT INTO grading_scores (
      slot_id,
      score,
      entered_by,
      entered_at
    )
    SELECT
      gsd.slot_id,
      gsd.score,
      gsd.grader_id,
      NOW()
    FROM grading_score_drafts gsd
    WHERE gsd.bag_id = ?
      AND gsd.grader_id = ?
      AND gsd.status = 'DRAFT'
  `;

  await conn.query(sql, [bagId, graderId]);
}
async markSlotsCompletedByBagIdAndGraderId(
  conn: PoolConnection,
  bagId: number,
  graderId: number
): Promise<void> {
  const sql = `
    UPDATE grading_slots gs
    JOIN booklets bk
      ON bk.id = gs.booklet_id
    SET gs.status = 'COMPLETED'
    WHERE bk.bag_id = ?
      AND gs.grader_id = ?
      AND gs.id IN (
        SELECT gsd.slot_id
        FROM grading_score_drafts gsd
        WHERE gsd.bag_id = ?
          AND gsd.grader_id = ?
          AND gsd.status = 'DRAFT'
      )
  `;

  await conn.query(sql, [bagId, graderId, bagId, graderId]);
}

async findActiveLockByGraderId(
  conn: PoolConnection,
  graderId: number
): Promise<any | null> {
  const sql = `
    SELECT
      id,
      grader_id,
      campaign_id,
      bag_id,
      question_no,
      status,
      locked_at
    FROM grader_work_locks
    WHERE grader_id = ?
      AND status = 'ACTIVE'
    LIMIT 1
    FOR UPDATE
  `;

  const [rows] = await conn.query<any[]>(sql, [graderId]);
  return rows[0] || null;
}
async createLock(
  conn: PoolConnection,
  params: {
    graderId: number;
    campaignId: number;
    bagId: number;
    questionNo: number;
    createdBy?: number | null;
  }
): Promise<number> {
  const sql = `
    INSERT INTO grader_work_locks (
      grader_id,
      campaign_id,
      bag_id,
      question_no,
      status,
      locked_at,
      created_by
    )
    VALUES (?, ?, ?, ?, 'ACTIVE', NOW(), ?)
  `;

  const [result] = await conn.query<ResultSetHeader>(sql, [
    params.graderId,
    params.campaignId,
    params.bagId,
    params.questionNo,
    params.createdBy ?? null,
  ]);

  return result.insertId;
}
async releaseActiveLockByGraderId(
  conn: PoolConnection,
  graderId: number
): Promise<void> {
  const sql = `
    UPDATE grader_work_locks
    SET
      status = 'RELEASED',
      released_at = NOW()
    WHERE grader_id = ?
      AND status = 'ACTIVE'
  `;

  await conn.query(sql, [graderId]);
}

async findActiveLockByBagAndQuestion(
  conn: PoolConnection,
  bagId: number,
  questionNo: number
): Promise<any | null> {
  const sql = `
    SELECT
      id,
      grader_id,
      campaign_id,
      bag_id,
      question_no,
      locked_at
    FROM grader_work_locks
    WHERE bag_id = ?
      AND status = 'ACTIVE'
    LIMIT 1
    FOR UPDATE
  `;

  const [rows] = await conn.query<any[]>(sql, [bagId]);
  return rows[0] || null;
}



}


const gradingslotRepo = new GradingslotRepo();
export default gradingslotRepo;
