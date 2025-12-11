// src/Repo/grader.repo.ts
import { PoolConnection, RowDataPacket } from "mysql2/promise";

/**
 * แถวที่ได้จาก join grading_slots + graders
 * 1 แถว = 1 slot ที่ถูก assign ให้ผู้ตรวจแล้ว
 */
export interface DbGraderAssignmentRow {
  grader_id: number;
  account_id: number;
  campaign_id: number;

  session_id: number;
  session_code: string;
  exam_date: string; // หรือ Date ถ้าคุณตั้งให้ mysql2 แปลงให้
  subject_id: number;
  subject_code: string;
  subject_name: string;
  grader_name: string
  subject_question_id: number;
  question_no: number
  question_label?: string;
}

class GraderRepo {
  /**
   * ดึง "ข้อที่ถูก assign ให้ตรวจแล้ว" ของ campaign หนึ่ง
   * ใช้ join grading_slots + graders
   */
  async findAllAssignmentsByCampaignId(
    campaignIdNumeric: number,
    connection: PoolConnection
  ): Promise<DbGraderAssignmentRow[]> {
    const sql = `
SELECT
    ga.grader_id,
    g.account_id,
    g.campaign_id,

    ga.session_id,
    s.session_code,
    s.exam_date,

    ga.subject_id,
    subj.code  AS subject_code,
    subj.name  AS subject_name,

    ga.subject_question_id,
    sq.question_no,          -- << ดึงเลขข้อจาก subject_questions
    sq.label AS question_label

FROM grader_assignments ga
JOIN graders g
  ON ga.grader_id = g.id
JOIN sessions s
  ON ga.session_id = s.id
JOIN subjects subj
  ON ga.subject_id = subj.id
JOIN subject_questions sq
  ON ga.subject_question_id = sq.id
WHERE g.campaign_id = ?
ORDER BY sq.question_no ASC;
  `;

    try {
      const [rows] = await connection.execute(sql, [campaignIdNumeric]);
      return rows as DbGraderAssignmentRow[];
    } catch (error) {
      console.error("Repo Error (Grader findAllAssignmentsByCampaignId):", error);
      throw error;
    }
  }


  async findAllAssignmentsByCampaignIdByGrader(
    campaignIdNumeric: number,
    connection: PoolConnection
  ): Promise<DbGraderAssignmentRow[]> {
    const sql = `
SELECT
    ga.grader_id,
    g.account_id,
    g.campaign_id,

    ga.session_id,
    s.session_code,
    s.exam_date,

    ga.subject_id,
    subj.code  AS subject_code,
    subj.name  AS subject_name,

    ga.subject_question_id,
    sq.question_no,
    sq.label AS question_label

FROM grader_assignments ga
JOIN graders g
  ON ga.grader_id = g.id
JOIN sessions s
  ON ga.session_id = s.id
JOIN subjects subj
  ON ga.subject_id = subj.id
JOIN subject_questions sq
  ON ga.subject_question_id = sq.id
WHERE g.campaign_id = ?
  AND ga.grader_id = ?      
ORDER BY sq.question_no ASC;

  `;

    try {
      const [rows] = await connection.execute(sql, [campaignIdNumeric]);
      return rows as DbGraderAssignmentRow[];
    } catch (error) {
      console.error("ดึงข้อมูลวิชาตรวจสำหรับผู้ตรวจผิดพลาด", error);
      throw error;
    }
  }


  async create(
    data: {
      campaign_id: number;
      name: string;
      active?: boolean;
      account_id?: number | null;
    },
    connection: PoolConnection
  ) {
    const sql = `
      INSERT INTO graders (campaign_id, name, active, account_id)
      VALUES (?, ?, ?, ?);
    `;

    try {
      const [result] = await connection.execute(sql, [
        data.campaign_id,
        data.name,
        data.active ?? true,
        data.account_id ?? null,
      ]);
      return result;
    } catch (error) {
      console.error("Repo Error (Grader create):", error);
      throw error;
    }
  }

  async updateById(
    id: number,
    data: {
      name?: string;
      active?: boolean;
      account_id?: number | null;
    },
    connection: PoolConnection
  ) {
    const sql = `
      UPDATE graders
      SET
        name       = COALESCE(?, name),
        active     = COALESCE(?, active),
        account_id = COALESCE(?, account_id)
      WHERE id = ?;
    `;

    try {
      const [result] = await connection.execute(sql, [
        data.name ?? null,
        typeof data.active === "boolean" ? (data.active ? 1 : 0) : null,
        data.account_id ?? null,
        id,
      ]);
      return result;
    } catch (error) {
      console.error("Repo Error (Grader updateById):", error);
      throw error;
    }
  }

  async deleteById(id: number, connection: PoolConnection) {
    const sql = `DELETE FROM graders WHERE id = ?;`;
    try {
      const [result] = await connection.execute(sql, [id]);
      return result;
    } catch (error) {
      console.error("Repo Error (Grader deleteById):", error);
      throw error;
    }
  }
}

const graderRepo = new GraderRepo();
export default graderRepo;
