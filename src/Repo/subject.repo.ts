


import { DB } from "../model/DB";
import { Pool } from "mysql2/promise";
import { RowDataPacket, ResultSetHeader } from "mysql2";

interface AddSubjectInput {
  session_code: string;
  subject_code: string;
  subject_name: string;
  start_at: string;   // ISO string e.g. '2025-06-01 09:00:00'
  end_at: string;
  q_count: number;
  q_range: string;
}


class subjectRepo {
    private pool: Pool
    constructor() {
        this.pool = DB.getInstance();
    }
    async getSubject(campaign_code: string): Promise<RowDataPacket[]> {

        const sql = `
SELECT
  s.id              AS session_id,
  s.session_code,
  s.exam_date,
  s.day_no,
  s.title,
  sub.code          AS subject_code,
  sub.name          AS subject_name,
  ss.start_at,
  ss.end_at,
  ss.question_count,
  ss.question_range,
  ss.order_no
FROM sessions s
JOIN exam_campaigns c ON c.id = s.campaign_id
JOIN exam_sites     e ON e.id = s.site_id
LEFT JOIN session_subjects ss ON ss.session_id = s.id
LEFT JOIN subjects sub        ON sub.id = ss.subject_id
WHERE c.code = ?
ORDER BY s.day_no, s.exam_date, ss.order_no;
    `;
        const params = [
            campaign_code
        ];
        const [result] = await this.pool.execute<RowDataPacket[]>(sql, params);
        return result;
    }
  async addSubjectToSession(input: AddSubjectInput): Promise<void> {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();

      // Step 1: Upsert subject
      await conn.execute(`
        INSERT INTO subjects (id, code, name)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE name = VALUES(name)
      `, [input.subject_code, input.subject_code, input.subject_name]);

      // Step 2: Upsert session_subjects
      await conn.execute(`
        INSERT INTO session_subjects
          (session_id, subject_id, start_at, end_at, question_count, question_range)
        SELECT s.id, sub.id, ?, ?, ?, ?
        FROM sessions s
        JOIN subjects sub ON sub.code = ?
        WHERE s.session_code = ?
        ON DUPLICATE KEY UPDATE
          start_at = VALUES(start_at),
          end_at = VALUES(end_at),
          question_count = VALUES(question_count),
          question_range = VALUES(question_range)
      `, [
        input.start_at,
        input.end_at,
        input.q_count,
        input.q_range,
        input.subject_code,
        input.session_code
      ]);

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err; // Re-throw for caller to handle
    } finally {
      conn.release();
    }
  }


}
const subjectrepo = new subjectRepo()
export default subjectrepo