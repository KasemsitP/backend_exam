import { DB } from "../model/DB";
import { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";

type DbClient = Pool | PoolConnection;

export interface CampaignKey extends RowDataPacket {
  id: number;
  campaign_id: number;
  key: string;
  iv: string;
  algor: string;
  created_at: string;
}

export interface CreateKeyPayload {
  campaign_id: number;
  account_id: number;
  key: string;
  iv: string;
  algor: string;
  order_num: number;
}
export interface SessionIdRow extends RowDataPacket {
  id: number;
}
interface CheckRoles {
  id: number;
  code: string;
}

interface KeyData {
  id: number;
  campaign_id: number;
  account_id: number;
  key: string;
  active: number;
  order_num: number;
}
interface KeyinCamp extends RowDataPacket { id: number; active: number }


class KeyRepo {
  private pool: Pool;
  constructor() {
    this.pool = DB.getInstance();
  }


  async findAllByCampaignId(
    campaignId: number,
    dbClient: DbClient = this.pool
  ): Promise<CampaignKey[]> {
    const sql = "SELECT ck.id , ck.campaign_id , ck.account_id , a.full_name , ck.key , ck.algor , ck.iv , ck.active , ck.created_at , ck.order_num FROM campaign_keys ck JOIN accounts a on ck.account_id = a.id WHERE campaign_id = ?;";
    const [rows] = await dbClient.execute<CampaignKey[]>(sql, [campaignId]);
    return rows;
  }


  async findAllByCampaignIdByManager(
    campaignId: number,
    AccountId: number,
    dbClient: DbClient = this.pool
  ): Promise<CampaignKey[]> {
    const sql = `
    SELECT ck.id , ck.campaign_id , ck.account_id , a.full_name , ck.key , ck.active , ck.created_at , ck.order_num , a.manager_order 
FROM campaign_keys ck JOIN accounts a on ck.account_id = a.id WHERE campaign_id = ? AND account_id = ?;
    `
    const [rows] = await dbClient.execute<CampaignKey[]>(sql, [campaignId, AccountId]);
    return rows;
  }

  async countByCampaignId(
    campaignId: number,
    dbClient: DbClient = this.pool
  ): Promise<number> {
    const sql = "SELECT COUNT(*) as count FROM campaign_keys WHERE campaign_id = ?";
    const [rows] = await dbClient.execute<RowDataPacket[]>(sql, [campaignId]);
    return rows[0].count;
  }





  //select s.id from sessions s JOIN exam_campaigns ec on s.campaign_id = ec.id WHERE campaign_id = ?;
  async selectSessionIdByCampaign(
    campaignId: number,
    dbClient: DbClient = this.pool
  ): Promise<SessionIdRow[]> {
    const sql = `
    SELECT s.id
    FROM sessions s
    JOIN exam_campaigns ec ON s.campaign_id = ec.id
    WHERE s.campaign_id = ?
  `;

    const [rows] = await dbClient.execute<SessionIdRow[]>(sql, [campaignId]);
    return rows;
  }
  async findById(
    id: number,
    dbClient: DbClient = this.pool
  ): Promise<CampaignKey | null> {
    const sql = "SELECT * FROM campaign_keys WHERE id = ?";
    const [rows] = await dbClient.execute<CampaignKey[]>(sql, [id]);
    return rows[0] || null;
  }


  async create(
    payload: CreateKeyPayload,
    dbClient: DbClient = this.pool
  ): Promise<CampaignKey> {
    const sql = `
      INSERT INTO campaign_keys (campaign_id,account_id, \`key\`, iv, algor,order_num) 
      VALUES (?,?, ?, ?, ?, ?)
    `;
    const params = [
      payload.campaign_id,
      payload.account_id,
      payload.key,
      payload.iv,
      payload.algor,
      payload.order_num
    ];

    const [result] = await dbClient.execute<any>(sql, params);
    const newId = result.insertId;

    const newKey = await this.findById(newId, dbClient);
    if (!newKey) {
      throw new Error("Failed to retrieve newly created key.");
    }
    return newKey;
  }


  async delete(id: number, dbClient: DbClient = this.pool): Promise<boolean> {
    const sql = "DELETE FROM campaign_keys WHERE id = ?";
    const [result] = await dbClient.execute<any>(sql, [id]);
    return result.affectedRows > 0;
  }
  async GetSessionDate(campaign_id: number): Promise<any[]> {
    const sql = `SELECT s.exam_date,  sj.start_at , sj.end_at from session_subjects sj JOIN sessions s ON s.id = sj.session_id WHERE s.campaign_id = ?;`
    const [rows] = await this.pool.query<RowDataPacket[]>(sql, [campaign_id]);
    return rows as any[];

  }


  async checkRoles(id: number, dbClient: DbClient = this.pool): Promise<CheckRoles | null> {
    const sql = "SELECT a.id,r.code  FROM roles r JOIN accounts a ON a.role_id = r.id  WHERE a.id = ? limit 1";
    const [rows] = await dbClient.execute<any>(sql, [id]);
    return rows[0] || null;
  }

  async findKeys(id: number, campaign_id: number, dbClient: DbClient = this.pool): Promise<KeyData | null> {
    const sql = "select ck.id , ck.campaign_id , ck.account_id , ck.key , ck.active , ck.order_num from campaign_keys ck WHERE ck.id = ? AND campaign_id = ? limit 1;";
    const [rows] = await dbClient.execute<any>(sql, [id, campaign_id]);
    return rows[0] || null;
  }

  async isAssigned(
    accountId: number,
    campaignId: number,
    dbClient: DbClient = this.pool
  ): Promise<boolean> {

    const sql = `
    SELECT EXISTS (
      SELECT 1
      FROM campaign_keys
      WHERE account_id = ?
        AND campaign_id = ?
    ) AS is_assigned
  `;

    const [rows]: any = await dbClient.execute(sql, [
      accountId,
      campaignId,
    ]);

    return Boolean(rows[0]?.is_assigned);
  }


  async KeyStatus(campaign_id: number): Promise<{
    key1_status: boolean;
    key2_status: boolean;
  }> {
    const sql = `
    SELECT
      EXISTS (
        SELECT 1 FROM campaign_keys 
        WHERE order_num = 1 
          AND campaign_id = ?
      ) AS key1_status,

      EXISTS (
        SELECT 1 FROM campaign_keys 
        WHERE order_num = 2 
          AND campaign_id = ?
      ) AS key2_status
  `;

    const [rows] = await this.pool.query<RowDataPacket[]>(sql, [
      campaign_id,
      campaign_id,
    ]);

    const result = rows[0];

    return {
      key1_status: Boolean(result.key1_status),
      key2_status: Boolean(result.key2_status),
    };
  }


  async updateKeyStatusActive(campaign_id: number, dbClient: DbClient = this.pool): Promise<boolean> {
    const sql = "UPDATE campaign_keys SET active = 1 WHERE campaign_id = ?";
    const [result] = await dbClient.execute<any>(sql, [campaign_id]);
    return result.affectedRows > 0;
  }
  async updateKeyStatusNonActive(campaign_id: number, dbClient: DbClient = this.pool): Promise<boolean> {
    const sql = "UPDATE campaign_keys SET active = 0 WHERE campaign_id = ?";
    const [result] = await dbClient.execute<any>(sql, [campaign_id]);
    return result.affectedRows > 0;
  }
  async getKeyCamp(campaign_id: number, dbClient: DbClient = this.pool): Promise<KeyinCamp[]> {
    const sql = "SELECT ck.id , ck.active from campaign_keys ck WHERE ck.campaign_id = ?;";
    const [rows] = await dbClient.execute<RowDataPacket[]>(sql, [campaign_id]);
    if (rows.length === 0) {
      throw new Error("ไม่พบคีย์สำหรับรอบสอบนี้");
    }
    return rows as KeyinCamp[];
  }

  async isKeyActive(id: number, dbClient: DbClient = this.pool): Promise<boolean> {
    const sql = "SELECT active FROM campaign_keys WHERE id = ?";
    const [rows] = await dbClient.execute<RowDataPacket[]>(sql, [id]);
    if (rows.length === 0) {
      throw new Error("Key not found");
    }
    return rows[0].active === 1;
  }

}



const keyRepo = new KeyRepo();
export default keyRepo;

