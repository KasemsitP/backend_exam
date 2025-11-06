import { DB } from "../model/DB";
import { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";

type DbClient = Pool | PoolConnection;

// Interfaces ที่ตรงกับ DB
interface User extends RowDataPacket {
  id: number;
  user_code: string;
  full_name: string;
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

  // (findOrCreateUser - เหมือนเดิม)
  async findOrCreateUser(
    payload: { user_code: string; full_name: string; national_id?: string },
    dbClient: DbClient
  ): Promise<{ user: User; created: boolean }> {
    const findSql = "SELECT * FROM users WHERE user_code = ?";
    const [rows] = await dbClient.execute<User[]>(findSql, [
      payload.user_code,
    ]);
    if (rows.length > 0) {
      return { user: rows[0], created: false };
    }
    const insertSql =
      "INSERT INTO users (user_code, full_name) VALUES (?, ?)";
    const [result] = await dbClient.execute<any>(insertSql, [
      payload.user_code,
      payload.full_name,
    ]);
    const newUser = await this.findById(result.insertId, dbClient);
    if (!newUser) {
      throw new Error("Failed to retrieve newly created user.");
    }
    return { user: newUser, created: true };
  }

  // (findOrCreateUserCampaign - เหมือนเดิม)
  async findOrCreateUserCampaign(
    payload: { user_id: number; campaign_id: number },
    dbClient: DbClient
  ): Promise<{ userCampaign: UserCampaign; created: boolean }> {
    const findSql =
      "SELECT * FROM user_campaigns WHERE user_id = ? AND campaign_id = ?";
    const [rows] = await dbClient.execute<UserCampaign[]>(findSql, [
      payload.user_id,
      payload.campaign_id,
    ]);
    if (rows.length > 0) {
      return { userCampaign: rows[0], created: false };
    }
    const insertSql =
      "INSERT INTO user_campaigns (user_id, campaign_id) VALUES (?, ?)";
    const [result] = await dbClient.execute<any>(insertSql, [
      payload.user_id,
      payload.campaign_id,
    ]);
    const newUserCampaign = await this.findUserCampaignById(
      result.insertId,
      dbClient
    );
    if (!newUserCampaign) {
      throw new Error("Failed to retrieve newly created user_campaign.");
    }
    return { userCampaign: newUserCampaign, created: true };
  }

  // [ ⭐️ นี่คือจุดที่แก้ไข ⭐️ ]
  // (แก้ปัญหา Error: ts(2353))
  async findOrCreateUserSession(
    // (1. เพิ่ม 'site_id' เข้าไปใน Type)
    payload: {
      user_campaign_id: number;
      session_id: number;
      campaign_id: number;
      site_id: number; 
    },
    dbClient: DbClient
  ): Promise<{ userSession: UserSession; created: boolean }> {
    const findSql =
      "SELECT * FROM user_sessions WHERE user_campaign_id = ? AND session_id = ?";
    const [rows] = await dbClient.execute<UserSession[]>(findSql, [
      payload.user_campaign_id,
      payload.session_id,
    ]);

    if (rows.length > 0) {
      return { userSession: rows[0], created: false };
    }

    // (2. เพิ่ม site_id ใน SQL)
    const insertSql =
      "INSERT INTO user_sessions (user_campaign_id, session_id, campaign_id, site_id) VALUES (?, ?, ?, ?)"; // 👈 (4 ?)
    
    // (3. เพิ่ม site_id ใน Params)
    const [result] = await dbClient.execute<any>(insertSql, [
      payload.user_campaign_id,
      payload.session_id,
      payload.campaign_id,
      payload.site_id, // 👈 (เพิ่ม)
    ]);
    
    const newUserSession = await this.findUserSessionById(
      result.insertId,
      dbClient
    );
    if (!newUserSession) {
      throw new Error("Failed to retrieve newly created user_session.");
    }
    return { userSession: newUserSession, created: true };
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
}

const userImportRepo = new UserImportRepo();
export default userImportRepo;

