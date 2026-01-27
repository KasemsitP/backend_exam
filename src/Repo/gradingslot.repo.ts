// src/Repo/gradingslot.repo.ts
import { PoolConnection, RowDataPacket, ResultSetHeader } from "mysql2/promise";


export interface BookletLookupRow extends RowDataPacket {
  booklet_id: number;
  user_session_id: number;
  user_campaign_id: number;
  user_id: number;
  user_code: string;
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
        u.id              AS user_id,
        u.user_code       AS user_code
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

  async  findAssignmentForGraderInSession(
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
        sq.label AS question_label
      FROM grader_assignments ga
      JOIN subject_questions sq
        ON ga.subject_question_id = sq.id
      WHERE ga.grader_id = ?
        AND ga.session_id = ?
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


}


const gradingslotRepo = new GradingslotRepo();
export default gradingslotRepo;
