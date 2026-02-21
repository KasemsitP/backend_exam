import { DB } from "../model/DB"; // (สมมติว่านี่คือไฟล์ DB Pool ของคุณ)
import { Pool, PoolConnection } from "mysql2/promise";
import { RowDataPacket } from "mysql2";

export type ApiBoolean = boolean | 0 | 1;

export interface ApiCampaign extends RowDataPacket {
  id: number;
  year_be: string;
  site: string
  campaign_size: string
  name: string;
  is_active: ApiBoolean;
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
    console.log(payload)
    const sql = `
INSERT INTO exam_campaigns
  (year_be, site, campaign_size, name, is_active)
VALUES
  (?, ?, ?, ?, ?);
    `;
    const params = [
      payload.year_be,
      payload.site,
      payload.campaign_size,
      payload.name,
      payload.is_active ? 1 : 1,
    ];

    const [result] = await dbClient.execute<any>(sql, params);
    const newId = result.insertId;

    return this.findById(newId, dbClient);
  }

  async CheckActiveCamp(): Promise<boolean> {
    const sql = `SELECT * FROM exam_campaigns WHERE is_active = 1;`
    const [rows] = await this.pool.execute<any[]>(sql);
    return rows.length > 0;
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

  async getIsDecrypted(campaign_id: number): Promise<boolean> {
    const sql = `
    SELECT e.is_unlock
    FROM exam_campaigns e
    WHERE e.id = ?
    LIMIT 1
  `;

    const [rows] = await this.pool.execute<RowDataPacket[]>(
      sql,
      [campaign_id]
    );

    if (!rows.length) {
      throw new Error("ไม่พบ campaign");
    }

    return rows[0].is_unlock === 1;
  }

  async unlockCampaign(campaign_id: number, dbClient: DbClient = this.pool): Promise<void> {
    const sql = `            UPDATE exam_campaigns
             SET is_unlock = 1
             WHERE id = ?`
    await dbClient.execute(sql, [campaign_id]);
  }

  async IscampaignActive(campaign_id: number , dbClient : DbClient = this.pool): Promise<boolean> {
    const sql = `
SELECT is_active
    FROM exam_campaigns
    WHERE id = ?
    LIMIT 1;
  `;
    const [rows] = await dbClient.execute<RowDataPacket[]>(sql, [campaign_id]);
    return rows[0].is_active === 1;
  }
}

const campaignRepo = new CampaignRepo();
export default campaignRepo;

