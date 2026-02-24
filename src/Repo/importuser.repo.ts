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
  async bulkUpdateQrPayload(
    updates: { id: number; payload: string }[],
    dbClient: DbClient | PoolConnection = this.pool
  ): Promise<boolean> {
    if (updates.length === 0) return true;

    const ids: number[] = [];
    const parameters: any[] = [];
    let caseQueries = "";

    // สร้างเงื่อนไข CASE WHEN สำหรับอัปเดตข้อมูลตาม ID
    for (const update of updates) {
      caseQueries += "WHEN ? THEN ? ";
      parameters.push(update.id, update.payload);
      ids.push(update.id);
    }

    const placeholders = ids.map(() => "?").join(",");
    // นำ ID ทั้งหมดไปต่อท้าย array สำหรับเงื่อนไข WHERE IN (...)
    parameters.push(...ids);

    const sql = `
      UPDATE user_sessions 
      SET qr_payload = CASE id 
        ${caseQueries}
      END
      WHERE id IN (${placeholders})
    `;

    await dbClient.execute(sql, parameters);
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

  async findPreviousNumber(
    campaignId: number,
    dbClient: DbClient = this.pool
  ): Promise<number> {
    const sql = `
SELECT count(uc.id) as count from user_campaigns uc WHERE uc.campaign_id = ?;
  `;
    const [rows] = await dbClient.execute<RowDataPacket[]>(sql, [campaignId]);
    const max = Number(rows[0]?.count ?? 0);
    return max;
  }

  async IsImported(
    campaignId: number,
    dbClient: DbClient = this.pool
  ): Promise<boolean> {

    const sql = `
    SELECT us.session_id, COUNT(us.id) AS count_users
    FROM user_sessions us
    JOIN user_campaigns uc 
      ON uc.id = us.user_campaign_id
    WHERE uc.campaign_id = ?
    GROUP BY us.session_id;
  `;

    const [rows] = await dbClient.execute<RowDataPacket[]>(sql, [campaignId]);

    if (rows.length === 0) return false;

    const firstCount = rows[0].count_users;

    return rows.every(row => row.count_users === firstCount);
  }


  // test optimized

  async bulkUpsertUsers(
    usersData: any[],
    dbClient: DbClient
  ): Promise<{ id: number; user_code: string }[]> {
    if (usersData.length === 0) return [];

    // เตรียม Array ซ้อน Array สำหรับ VALUES ?
    const values = usersData.map((u) => [
      u.userCode,
      u.fullName,
      u.firstName,
      u.lastName,
      u.title,
      u.nationalId ?? null,
      u.birthDate ?? null,
    ]);

    const sql = `
      INSERT INTO users (user_code, full_name, first_name, last_name, title, national_id, birth_date)
      VALUES ?
      ON DUPLICATE KEY UPDATE
        full_name = VALUES(full_name),
        first_name = VALUES(first_name),
        last_name = VALUES(last_name),
        title = VALUES(title),
        national_id = IFNULL(VALUES(national_id), users.national_id),
        birth_date = IFNULL(VALUES(birth_date), users.birth_date)
    `;

    // ⚠️ สำคัญมาก: ต้องใช้ .query() เพื่อให้ '?' รองรับ Array 2 มิติ
    await dbClient.query(sql, [values]);

    // เนื่องจาก MySQL ไม่รองรับ RETURNING เราจึงต้อง SELECT กลับมาด้วย user_code
    const userCodes = usersData.map((u) => u.userCode);
    const fetchSql = `SELECT id, user_code FROM users WHERE user_code IN (?)`;
    const [rows] = await dbClient.query(fetchSql, [userCodes]);

    return rows as { id: number; user_code: string }[];
  }

  async bulkInsertUserCampaigns(
    campaignData: { userId: number; campaignId: number }[],
    dbClient: DbClient
  ): Promise<{ id: number; user_id: number }[]> {
    if (campaignData.length === 0) return [];

    const values = campaignData.map((c) => [c.userId, c.campaignId]);

    // ใช้ INSERT IGNORE เพื่อข้ามถ้าคนนี้เคยผูก Campaign นี้ไปแล้ว
    const sql = `INSERT IGNORE INTO user_campaigns (user_id, campaign_id) VALUES ?`;
    await dbClient.query(sql, [values]);

    // SELECT IDs กลับมาเพื่อไปผูกกับ Sessions ต่อ
    const userIds = campaignData.map((c) => c.userId);
    const campaignId = campaignData[0].campaignId;
    const fetchSql = `SELECT id, user_id FROM user_campaigns WHERE campaign_id = ? AND user_id IN (?)`;
    const [rows] = await dbClient.query(fetchSql, [campaignId, userIds]);

    return rows as { id: number; user_id: number }[];
  }

  async bulkInsertUserSessions(
    sessionData: { userCampaignId: number; sessionId: number; campaignId: number }[],
    dbClient: DbClient
  ): Promise<number> {
    if (sessionData.length === 0) return 0;

    const values = sessionData.map((s) => [s.userCampaignId, s.sessionId, s.campaignId]);
    const sql = `INSERT IGNORE INTO user_sessions (user_campaign_id, session_id, campaign_id) VALUES ?`;

    const [result]: any = await dbClient.query(sql, [values]);
    return result.affectedRows; // คืนค่าจำนวนแถวที่ถูกสร้างสำเร็จ
  }
}

const userImportRepo = new UserImportRepo();
export default userImportRepo;

