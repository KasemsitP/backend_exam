import { DB } from "../model/DB";
import { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";

export interface ApiSession extends RowDataPacket {
  id: number;
  session_code: string;
  exam_date: string;
  campaign_id: number;
  day_no: number;
  title?: string;
}

export type CreateSessionPayload = Omit<ApiSession, "id">;
type DbClient = Pool | PoolConnection;

class SessionRepo {
  private pool: Pool;
  constructor() {
    this.pool = DB.getInstance();
  }


  async create(
    payload: CreateSessionPayload,
    dbClient: DbClient = this.pool
  ): Promise<ApiSession> {
    const sql = `
      INSERT INTO sessions 
        (campaign_id, session_code, title, exam_date, day_no) 
      VALUES (?, ?, ?, ?, ?)
    `;
    const params = [
      payload.campaign_id,
      payload.session_code,
      payload.title,
      payload.exam_date,
      payload.day_no,
    ];

    const [result] = await dbClient.execute<any>(sql, params);
    const newId = result.insertId;
    return this.findById(newId, dbClient);
  }

  async checkisDuplicateSessionCode(
    session_code: string,
    campaign_id: number,
    dbClient: DbClient = this.pool
  ): Promise<boolean> {
    const sql = `SELECT 1 FROM sessions WHERE session_code = ? AND campaign_id = ? LIMIT 1`;
    const [rows] = await dbClient.execute<RowDataPacket[]>(sql, [session_code, campaign_id]);
    return rows.length > 0;
  }


  async findById(
    id: number,
    dbClient: DbClient = this.pool
  ): Promise<ApiSession> {
    const sql = "SELECT * FROM sessions WHERE id = ?";
    const [rows] = await dbClient.execute<ApiSession[]>(sql, [id]);
    if (rows.length === 0) {
      throw new Error(`Session with ID ${id} not found.`);
    }
    return rows[0];
  }


  async deleteByCampaignId(
    campaignId: number,
    dbClient: DbClient = this.pool
  ): Promise<boolean> {
    const sql = "DELETE FROM sessions WHERE campaign_id = ?";
    const [result] = await dbClient.execute<any>(sql, [campaignId]);
    // ไม่จำเป็นต้องเช็ค affectedRows เพราะถ้าไม่มี session ให้ลบ (0 rows)
    // ก็ไม่ถือว่าเป็น Error
    return true;
  }

  /**
   * (โค้ดเดิม)
   * ลบ Session เดียว (รองรับ Transaction)
   */
async delete(id: number): Promise<boolean> {
  const connection = await this.pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1️⃣ ลบ child
    await connection.execute(
      "DELETE FROM session_subjects WHERE session_id = ?",
      [id]
    );

    // 2️⃣ ลบ parent
    const [result]: any = await connection.execute(
      "DELETE FROM sessions WHERE id = ?",
      [id]
    );

    await connection.commit();

    return result.affectedRows > 0;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release(); // สำคัญมาก
  }
}
  async findAllLiteByCampaignId(
    campaignId: number,
    dbClient: DbClient = this.pool
  ): Promise<Array<{ id: number }>> {

    const sql = "SELECT id FROM sessions WHERE campaign_id = ?";
    const [rows] = await dbClient.execute<RowDataPacket[]>(sql, [
      campaignId,
    ]);

    // (แปลงผลลัพธ์ให้ถูกต้อง)
    return rows.map(row => ({
      id: row.id,
    }));
  }
}

const sessionRepo = new SessionRepo();
export default sessionRepo;