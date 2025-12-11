// src/Repo/gradingscore.repo.ts
import { DB } from "../model/DB";
import { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from "mysql2/promise";

export interface DbGradingScoreRow extends RowDataPacket {
  gradingscoreId: number;
  slotId: number;
  score: number;
  status: string;
  enteredAt: Date;
  graderId: number;
  graderName: string;
}

export interface GradingRecordAll extends RowDataPacket{
  score: number
  slotId : number
  enteredAT: Date
}


class GradingScoreRepo {
  private pool: Pool;
  constructor() {
    this.pool = DB.getInstance();
  }
async verifySlotContext(
  conn: PoolConnection,
  params: {
    slotId: number;
    campaignId: number;
    graderId: number;
  }
): Promise<boolean> {
  const { slotId, campaignId, graderId } = params;

  const sql = `
    SELECT
      s.id AS slot_id
    FROM grading_slots s
    JOIN booklets b
      ON s.booklet_id = b.id
    JOIN user_sessions us
      ON b.user_session_id = us.id
    WHERE s.id = ?
      AND us.campaign_id = ?
      AND s.grader_id = ?
    LIMIT 1;
  `;

  const paramsArr = [slotId, campaignId, graderId];

  const [rows] = await conn.execute<RowDataPacket[]>(sql, paramsArr);
  return rows.length > 0;
}

  /**
   * INSERT ลง grading_scores
   * คืน id ที่พึ่ง insert มา
   */
  async insertScore(
    conn: PoolConnection,
    slotId: number,
    score: number,
    graderId: number
  ): Promise<number> {
    const sql = `
      INSERT INTO grading_scores (slot_id, score, entered_by)
      VALUES (?, ?, ?)
    `;
    const [result] = await conn.execute<ResultSetHeader>(sql, [
      slotId,
      score,
      graderId,
    ]);

    return result.insertId;
  }

  /**
   * อัปเดตสถานะของ slot (เช่น COMPLETED / DISPUTED ฯลฯ)
   */
  async updateSlotStatus(
    conn: PoolConnection,
    slotId: number,
    status: string
  ): Promise<void> {
    const sql = `
      UPDATE grading_slots
      SET status = ?
      WHERE id = ?
    `;
    await conn.execute(sql, [status, slotId]);
  }

  /**
   * ดึงข้อมูลคะแนนที่เพิ่งบันทึก พร้อม join ไปเอาชื่อ grader และ status ของ slot
   */
  async findScoreById(
    conn: PoolConnection,
    gradingScoreId: number
  ): Promise<DbGradingScoreRow | null> {
    const sql = `
      SELECT
        gs.id        AS gradingscoreId,
        gs.slot_id   AS slotId,
        gs.score     AS score,
        s.status     AS status,
        gs.entered_at AS enteredAt,
        g.id         AS graderId,
        COALESCE(a.full_name, CONCAT('Grader #', g.id)) AS graderName
      FROM grading_scores gs
      JOIN grading_slots s
        ON gs.slot_id = s.id
      JOIN graders g
        ON gs.entered_by = g.id
      LEFT JOIN accounts a
        ON g.account_id = a.id
      WHERE gs.id = ?
      LIMIT 1;
    `;

    const [rows] = await conn.execute<DbGradingScoreRow[]>(sql, [gradingScoreId]);
    return rows[0] || null;
  }
  async FindAllRecord(
    grader_id: number
  ): Promise<GradingRecordAll[] | null> {
    const sql = `
      SELECT 
    g.slot_id,
    g.score,
    g.entered_at
FROM grading_scores g
WHERE g.entered_by = ?
ORDER BY g.entered_at DESC

LIMIT 0, 25;
    `;
    const [rows] = await this.pool.execute<GradingRecordAll []>(sql, [grader_id]);
    return rows.length ? rows : null;
  }
}

const gradingscoreRepo = new GradingScoreRepo();
export default gradingscoreRepo;
