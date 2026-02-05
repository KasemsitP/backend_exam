import { DB } from "../model/DB";
import { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type { ResultSetHeader } from "mysql2/promise";

type DbClient = Pool | PoolConnection;

// Interfaces ที่ตรงกับ DB
interface User extends RowDataPacket {
  id: number;
  user_code: string;
  full_name: string;
  first_name: string;
  last_name: string;
  title: string;
}
interface UserCampaign extends RowDataPacket {
  id: number;
  user_id: number;
  campaign_id: number;
}
interface UserSession extends RowDataPacket {
  id: number;
  user_campaign_id: number;
  session_id: number;
}
interface UserSessionLink {
  user_id: number;
  user_campaign_id: number;
  user_session_id: number;
}

// (Helper Finders - เหมือนเดิม)
class UserImportRepo {
  private pool: Pool;
  constructor() {
    this.pool = DB.getInstance();
  }

  /** (Helper) ค้นหา User ด้วย ID */
  async findById(id: number, dbClient: DbClient): Promise<User | null> {
    const sql = "SELECT * FROM users WHERE id = ?";
    const [rows] = await dbClient.execute<User[]>(sql, [id]);
    return rows[0] || null;
  }

  /** (Helper) ค้นหา UserCampaign ด้วย ID */
  async findUserCampaignById(
    id: number,
    dbClient: DbClient
  ): Promise<UserCampaign | null> {
    const sql = "SELECT * FROM user_campaigns WHERE id = ?";
    const [rows] = await dbClient.execute<UserCampaign[]>(sql, [id]);
    return rows[0] || null;
  }

  /** (Helper) ค้นหา UserSession ด้วย ID */
  async findUserSessionById(
    id: number,
    dbClient: DbClient
  ): Promise<UserSession | null> {
    const sql = "SELECT * FROM user_sessions WHERE id = ?";
    const [rows] = await dbClient.execute<UserSession[]>(sql, [id]);
    return rows[0] || null;
  }

async findOrCreateUser(
  payload: {
    user_code: string;
    full_name: string;
    first_name: string;
    last_name: string;
    title: string;
    national_id?: string | null;
    birth_date?: string | null; // ควรเป็น 'YYYY-MM-DD'
  },
  dbClient: DbClient
): Promise<{ user: User; created: boolean }> {
  const sql = `
    INSERT INTO users (
      user_code,
      full_name,
      first_name,
      last_name,
      title,
      national_id,
      birth_date
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      -- sync ชื่อ ตามไฟล์ล่าสุด
      full_name   = VALUES(full_name),
      first_name  = VALUES(first_name),
      last_name   = VALUES(last_name),
      title       = VALUES(title),
      -- ถ้ามีค่าใหม่ให้อัปเดต แต่ถ้า null ก็ใช้ค่าเดิม
      national_id = IFNULL(VALUES(national_id), national_id),
      birth_date  = IFNULL(VALUES(birth_date),  birth_date),
      -- trick สำคัญ: ทำให้ insertId กลายเป็น id เดิมตอน duplicate
      id = LAST_INSERT_ID(id)
  `;

  const [result] = await dbClient.execute<ResultSetHeader>(sql, [
    payload.user_code,
    payload.full_name,
    payload.first_name,
    payload.last_name,
    payload.title,
    payload.national_id ?? null,
    payload.birth_date ?? null,
  ]);

  const created = result.affectedRows === 1; // 1 = insert ใหม่, 2 = update
  const newId = result.insertId;

  const user = await this.findById(newId, dbClient);
  if (!user) {
    throw new Error("Failed to retrieve user after upsert.");
  }
  return { user, created };
}
  async findOrCreateUserCampaign(
    payload: { user_id: number; campaign_id: number },
    dbClient: DbClient
  ): Promise<{ userCampaign: UserCampaign; created: boolean }> {
    const sql = `
    INSERT INTO user_campaigns (user_id, campaign_id)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE
      id = LAST_INSERT_ID(id)
  `;

    const [result] = await dbClient.execute<ResultSetHeader>(sql, [
      payload.user_id,
      payload.campaign_id,
    ]);

    const created = result.affectedRows === 1;
    const newId = result.insertId;

    const userCampaign = await this.findUserCampaignById(newId, dbClient);
    if (!userCampaign) {
      throw new Error("Failed to retrieve user_campaign after upsert.");
    }
    return { userCampaign, created };
  }

  async findOrCreateUserSession(
    payload: {
      user_campaign_id: number;
      session_id: number;
      campaign_id: number;
    },
    dbClient: DbClient
  ): Promise<{ userSession: UserSession; created: boolean }> {
    const sql = `
    INSERT INTO user_sessions (user_campaign_id, session_id, campaign_id)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE
      id = LAST_INSERT_ID(id)
  `;

    const [result] = await dbClient.execute<ResultSetHeader>(sql, [
      payload.user_campaign_id,
      payload.session_id,
      payload.campaign_id,
    ]);

    const created = result.affectedRows === 1;
    const newId = result.insertId;

    const userSession = await this.findUserSessionById(newId, dbClient);
    if (!userSession) {
      throw new Error("Failed to retrieve user_session after upsert.");
    }
    return { userSession, created };
  }

  async countByCampaignId(
    campaignId: number,
    dbClient: DbClient = this.pool
  ): Promise<number> {
    const sql = "SELECT COUNT(*) as count FROM user_campaigns WHERE campaign_id = ?";
    const [rows] = await dbClient.execute<RowDataPacket[]>(sql, [campaignId]);
    return rows[0].count;
  }

  async findAllUserLinksForSession(
    sessionId: number,
    dbClient: DbClient = this.pool
  ): Promise<UserSessionLink[]> {
    const sql = `
      SELECT 
        u.user_code AS user_id,
        uc.id AS user_campaign_id,
        us.id AS user_session_id
      FROM 
        user_sessions us
      JOIN 
        user_campaigns uc ON us.user_campaign_id = uc.id
      JOIN 
        users u ON uc.user_id = u.id
      WHERE 
        us.session_id = ?
    `;
    const [rows] = await dbClient.execute<RowDataPacket[]>(sql, [sessionId]);
    return rows as UserSessionLink[];
  }

  /**
   * [ ⭐️ นี่คือฟังก์ชันที่ถูกต้อง ⭐️ ]
   * อัปเดต qr_payload ในตาราง user_sessions
   */
  async updateQrPayload(
    userSessionId: number,
    qrPayload: string,
    dbClient: DbClient = this.pool
  ): Promise<boolean> {
    const sql = "UPDATE user_sessions SET qr_payload = ? WHERE id = ?";
    const [result] = await dbClient.execute<any>(sql, [
      qrPayload,
      userSessionId,
    ]);
    if (result.affectedRows === 0) {
      throw new Error(
        `Failed to update qr_payload: user_session_id ${userSessionId} not found.`
      );
    }
    return true;
  }

  async findMaxUserCodeByCampaign(
    campaignId: number,
    dbClient: DbClient = this.pool
  ): Promise<number> {
    const sql = `
    SELECT 
      COALESCE(MAX(CAST(u.user_code AS UNSIGNED)), 0) AS max_user_code
    FROM users u
    JOIN user_campaigns uc ON u.id = uc.user_id
    WHERE uc.campaign_id = ?
  `;
    const [rows] = await dbClient.execute<RowDataPacket[]>(sql, [campaignId]);
    const max = Number(rows[0]?.max_user_code ?? 0);
    return max;
  }
}

const userImportRepo = new UserImportRepo();
export default userImportRepo;

