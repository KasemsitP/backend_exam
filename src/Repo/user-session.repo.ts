import { DB } from "../model/DB";
import { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";

// (Interface นี้มาจาก Slice)
interface UserSessionData {
  user_session_id: number;
  user_id: number;
  userCode: string;
  firstName: string;
  lastName: string;
  roomName: string | null;
  qr_payload: string | null;
}

export interface DbUserSessionRow extends RowDataPacket {
  id: number;       // user_sessions.id
  user_id: number;
  user_code: string;
}

class UserSessionsRepo {
  private pool: Pool;
  constructor() {
    this.pool = DB.getInstance();
  }
  async findBySessionId(sessionId: number): Promise<UserSessionData[]> {
    const connection = await DB.getInstance().getConnection();
    try {
      // ⭐️⭐️⭐️ (FIX) แก้ไข SQL Query ที่นี่ ⭐️⭐️⭐️
      //
      // Error 'Unknown column 'er.room_name'' เกิดขึ้น
      // เราจะเปลี่ยนกลับไปใช้ 'er.name'
      //
      const sql = `
SELECT
    us.id            AS user_session_id,
    u.id             AS user_id,
    u.user_code      AS userCode,
    u.full_name      AS firstName,
    ''               AS lastName,
    er.room_code     AS roomName,    -- ใช้ room_code เป็นชื่อห้อง (ถ้ายังไม่มีคอลัมน์ name)
    us.qr_payload
FROM user_sessions us
JOIN user_campaigns uc
  ON us.user_campaign_id = uc.id
JOIN users u
  ON uc.user_id = u.id
LEFT JOIN exam_rooms er
  ON er.session_id = us.session_id
 AND er.room_code  = us.room_code
WHERE us.session_id = ?;
    `;


      const [rows] = (await connection.execute(sql, [sessionId])) as [
        UserSessionData[],
        any
      ];
      return rows;
    } catch (error) {
      console.error("Repo Error (findUserSessions):", error);
      throw error;
    } finally {
      connection.release();
    }
  }
  async findByUserIdAndSessionId(
    userId: number,
    sessionId: number,
    connection: PoolConnection
  ): Promise<UserSessionData | undefined> {
    try {
      const sql = `
SELECT
    us.id as user_session_id,
    u.id as user_id,
    u.user_code as userCode,
    u.full_name as firstName, 
    '' as lastName, 
    er.name as roomName, 
    us.qr_payload
FROM
    user_sessions us
JOIN
    users u ON us.user_id = u.id
LEFT JOIN
    exam_rooms er ON us.exam_room_id = er.id
WHERE
    us.user_id = ? AND us.exam_session_id = ?
LIMIT 1;
`;
      const [rows] = (await connection.execute(sql, [userId, sessionId])) as [
        UserSessionData[],
        any
      ];
      return rows[0]; // (คืนค่าตัวแรกที่เจอ หรือ undefined)
    } catch (error) {
      console.error("Repo Error (findByUserIdAndSessionId):", error);
      throw error;
    }
    // (ไม่ต้อง release connection ที่นี่ เพราะ Service จัดการ)
  };
  async findByUserCodeAndSessionId(
    userCode: string,
    sessionId: number,
    connection: PoolConnection
  ): Promise<UserSessionData | undefined> {
    console.log(userCode)
    const sql = `
SELECT 
    us.id AS user_session_id,
    u.id AS user_id,
    u.user_code AS userCode,
    u.full_name AS firstName,
    '' AS lastName,
    us.room_code AS roomName,
    us.qr_payload
FROM user_sessions us
JOIN user_campaigns uc ON us.user_campaign_id = uc.id
JOIN users u ON uc.user_id = u.id
WHERE 
    u.user_code = ? AND us.session_id = ?
LIMIT 1;
`;
    try {
      const [rows] = (await connection.execute(sql, [userCode, sessionId])) as [UserSessionData[], any];
      return rows[0];
    } catch (error) {
      console.error("Repo Error (findByUserCodeAndSessionId):", error);
      throw error;
    }
  }
  async findUserSessionByCampaignSessionAndUserCode(
    conn: PoolConnection,
    params: { campaignId: number; sessionId: number; userCode: string }
  ): Promise<DbUserSessionRow | null> {
    const { campaignId, sessionId, userCode } = params;

    const sql = `
      SELECT
        us.id         AS id,
        u.id          AS user_id,
        u.user_code   AS user_code
      FROM users u
      JOIN user_campaigns uc
        ON uc.user_id = u.id
       AND uc.campaign_id = ?
      JOIN user_sessions us
        ON us.user_campaign_id = uc.id
       AND us.session_id = ?
       AND us.campaign_id = ?
      WHERE u.user_code = ?
      LIMIT 1;
    `;

    const [rows] = await conn.execute<DbUserSessionRow[]>(sql, [
      campaignId,
      sessionId,
      campaignId,
      userCode,
    ]);

    return rows[0] || null;
  }
}

const userSessionsRepo = new UserSessionsRepo();
export default userSessionsRepo;

