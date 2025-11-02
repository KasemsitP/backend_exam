import { DB } from "../model/DB";
import { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";

type DbClient = Pool | PoolConnection;

// --- Interfaces ---
export interface CampaignKey extends RowDataPacket {
  id: number;
  campaign_id: number;
  key: string; // [ ⭐️ FIX ⭐️ ] (key_alias -> key)
  iv: string;
  algor: string;
  created_at: string;
}

export interface CreateKeyPayload { // [ ⭐️ FIX ⭐️ ]
  campaign_id: number;
  key: string;
  iv: string;
  algor: string;
}

// --- Repo Class ---
class KeyRepo {
  private pool: Pool;
  constructor() {
    this.pool = DB.getInstance();
  }

  /**
   * ค้นหาคีย์ทั้งหมด
   */
  async findAllByCampaignId(
    campaignId: number,
    dbClient: DbClient = this.pool
  ): Promise<CampaignKey[]> {
    const sql = "SELECT * FROM campaign_keys WHERE campaign_id = ?";
    const [rows] = await dbClient.execute<CampaignKey[]>(sql, [campaignId]);
    return rows;
  }

  /**
   * นับจำนวนคีย์
   */
  async countByCampaignId(
    campaignId: number,
    dbClient: DbClient = this.pool
  ): Promise<number> {
    const sql = "SELECT COUNT(*) as count FROM campaign_keys WHERE campaign_id = ?";
    const [rows] = await dbClient.execute<RowDataPacket[]>(sql, [campaignId]);
    return rows[0].count;
  }

  /**
   * (Helper) ค้นหาด้วย ID
   */
  async findById(
    id: number,
    dbClient: DbClient = this.pool
  ): Promise<CampaignKey | null> {
    const sql = "SELECT * FROM campaign_keys WHERE id = ?";
    const [rows] = await dbClient.execute<CampaignKey[]>(sql, [id]);
    return rows[0] || null;
  }

  /**
   * [ ⭐️ 3. Create Key (แก้ไข) ⭐️ ]
   * (key_alias -> key)
   */
  async create(
    payload: CreateKeyPayload,
    dbClient: DbClient = this.pool
  ): Promise<CampaignKey> {
    const sql = `
      INSERT INTO campaign_keys (campaign_id, \`key\`, iv, algor) 
      VALUES (?, ?, ?, ?)
    `; // [ ⭐️ FIX ⭐️ ] (เพิ่ม backticks รอบ `key`)
    const params = [
      payload.campaign_id,
      payload.key, // [ ⭐️ FIX ⭐️ ]
      payload.iv,
      payload.algor,
    ];

    const [result] = await dbClient.execute<any>(sql, params);
    const newId = result.insertId;

    const newKey = await this.findById(newId, dbClient);
    if (!newKey) {
      throw new Error("Failed to retrieve newly created key.");
    }
    return newKey;
  }

  /**
   * ลบคีย์
   */
  async delete(id: number, dbClient: DbClient = this.pool): Promise<boolean> {
    const sql = "DELETE FROM campaign_keys WHERE id = ?";
    const [result] = await dbClient.execute<any>(sql, [id]);
    return result.affectedRows > 0;
  }
}

const keyRepo = new KeyRepo();
export default keyRepo;

