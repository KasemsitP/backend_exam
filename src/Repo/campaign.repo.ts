import { DB } from "../model/DB"; // (สมมติว่านี่คือไฟล์ DB Pool ของคุณ)
import { Pool, PoolConnection } from "mysql2/promise";
import { RowDataPacket } from "mysql2";

export type ApiBoolean = boolean | 0 | 1;

export interface ApiCampaign extends RowDataPacket {
  id: number;
  code: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: ApiBoolean;
  note?: string;
}

export type CreateCampaignPayload = Omit<ApiCampaign, "id">;


type DbClient = Pool | PoolConnection;

class CampaignRepo {
  private pool: Pool;
  constructor() {
    this.pool = DB.getInstance();
  }

  async create(
    payload: CreateCampaignPayload,
    dbClient: DbClient = this.pool
  ): Promise<ApiCampaign> {
    const sql = `
      INSERT INTO exam_campaigns 
        (code, name, start_date, end_date, is_active, note) 
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const params = [
      payload.code,
      payload.name,
      payload.start_date,
      payload.end_date,
      payload.is_active,
      payload.note,
    ];

    const [result] = await dbClient.execute<any>(sql, params); // 👈 ใช้ dbClient
    const newId = result.insertId;

    return this.findById(newId, dbClient); // 👈 ส่ง dbClient ต่อ
  }
  async update(
    payload: CreateCampaignPayload,
    dbClient: DbClient = this.pool
  ): Promise<ApiCampaign> {
    const sql = `
    UPDATE exam_campaigns
    SET code = ?, 
        name = ?, 
        start_date = ?, 
        end_date = ?, 
        is_active = ?, 
        note = ?
    WHERE id = ?
  `;

    const params = [
      payload.code,
      payload.name,
      payload.start_date,
      payload.end_date,
      payload.is_active,
      payload.note,
      payload.id, 
    ];

    await dbClient.execute<any>(sql, params);

    return this.findById(payload.id, dbClient);
  }

  /**
   * [FIX] อัปเดต 'delete' ให้รับ dbClient (โค้ดนี้ถูกต้องอยู่แล้ว)
   */
  async delete(id: number, dbClient: DbClient = this.pool): Promise<boolean> {
    const sql = "DELETE FROM exam_campaigns WHERE id = ?";
    const [result] = await dbClient.execute<any>(sql, [id]); // 👈 ใช้ dbClient
    return result.affectedRows > 0;
  }

  /**
   * [FIX] อัปเดต 'findById' ให้รับ dbClient (สำหรับ Transaction)
   */
  async findById(
    id: number,
    dbClient: DbClient = this.pool
  ): Promise<ApiCampaign> {
    const sql = "SELECT * FROM exam_campaigns WHERE id = ?";
    const [rows] = await dbClient.execute<ApiCampaign[]>(sql, [id]); // 👈 ใช้ dbClient
    if (rows.length === 0) {
      throw new Error(`Campaign with ID ${id} not found.`);
    }
    return rows[0];
  }
  async findOrCreateByCode(
    payload: CreateCampaignPayload,
    dbClient: DbClient
  ): Promise<{ campaign: ApiCampaign; created: boolean }> {
    const findSql = "SELECT * FROM exam_campaigns WHERE code = ?";
    const [rows] = await dbClient.execute<ApiCampaign[]>(findSql, [
      payload.code,
    ]);

    if (rows.length > 0) {
      return { campaign: rows[0], created: false };
    }
    const newCampaign = await this.create(payload, dbClient);
    return { campaign: newCampaign, created: true };
  }
}

const campaignRepo = new CampaignRepo();
export default campaignRepo;

