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
  order_num : number;
}
export interface SessionIdRow extends RowDataPacket {
  id: number;
}

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
    AccountId  : number, 
    dbClient: DbClient = this.pool
  ): Promise<CampaignKey[]> {
    const sql = "SELECT * FROM campaign_keys WHERE campaign_id = ? and account_id  = ?";
    const [rows] = await dbClient.execute<CampaignKey[]>(sql, [campaignId , AccountId]);
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
}

const keyRepo = new KeyRepo();
export default keyRepo;

