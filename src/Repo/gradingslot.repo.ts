// src/Repo/gradingslot.repo.ts
import { PoolConnection, RowDataPacket, ResultSetHeader } from "mysql2/promise";

export interface BookletSubjectLookupRow extends RowDataPacket {
  booklet_subject_id: number;
  booklet_id: number;
  user_session_id: number;
  user_campaign_id: number;
  user_id: number;
  user_code: string;
}

export interface GradingSlotRow extends RowDataPacket {
  id: number;
  booklet_subject_id: number;
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
  async findBookletSubjectForUser(
    conn: PoolConnection,
    campaignId: number,
    sessionId: number,
    subjectId: number,
    userCode: string
  ): Promise<BookletSubjectLookupRow | null> {
    const sql = `
      SELECT
        bs.id             AS booklet_subject_id,
        bs.booklet_id     AS booklet_id,
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
      JOIN booklet_subjects bs
        ON bs.booklet_id = b.id
        AND bs.subject_id = ?
        AND bs.session_id = ?
      WHERE u.user_code = ?
      LIMIT 1;
    `;

    const params = [
      campaignId,
      sessionId,
      campaignId,
      subjectId,
      sessionId,
      userCode,
    ];

    const [rows] = await conn.execute<BookletSubjectLookupRow[]>(sql, params);
    return rows[0] || null;
  }

  /**
   * ดึง slot ทั้งหมดของกระดาษใบนี้ + ข้อนี้
   * ถ้า forUpdate = true จะ FOR UPDATE (ใช้ใน transaction)
   */
  async findSlotsByBookletAndQuestion(
    conn: PoolConnection,
    bookletSubjectId: number,
    questionNo: number,
    forUpdate: boolean = false
  ): Promise<GradingSlotRow[]> {
    const sql = `
      SELECT id, booklet_subject_id, question_no, grader_order, status, grader_id
      FROM grading_slots
      WHERE booklet_subject_id = ? AND question_no = ?
      ${forUpdate ? "FOR UPDATE" : ""}
    `;
    const [rows] = await conn.execute<GradingSlotRow[]>(sql, [
      bookletSubjectId,
      questionNo,
    ]);
    return rows;
  }

  /**
   * สร้าง slot ใหม่ให้ผู้ตรวจ (status = 'ASSIGNED')
   */
  async insertSlot(
    conn: PoolConnection,
    bookletSubjectId: number,
    questionNo: number,
    graderOrder: number,
    graderId: number
  ): Promise<GradingSlotRow> {
    const insertSql = `
      INSERT INTO grading_slots (
        booklet_subject_id,
        question_no,
        grader_order,
        status,
        grader_id
      )
      VALUES (?, ?, ?, 'ASSIGNED', ?)
    `;
    const [result] = await conn.execute<ResultSetHeader>(insertSql, [
      bookletSubjectId,
      questionNo,
      graderOrder,
      graderId,
    ]);

    const newId = result.insertId;

    const [rows] = await conn.execute<GradingSlotRow[]>(
      `
      SELECT id, booklet_subject_id, question_no, grader_order, status, grader_id
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
}

const gradingslotRepo = new GradingslotRepo();
export default gradingslotRepo;
