"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const DB_1 = require("../model/DB");
class UserSessionsRepo {
    constructor() {
        this.pool = DB_1.DB.getInstance();
    }
    findBySessionId(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            const connection = yield DB_1.DB.getInstance().getConnection();
            try {
                // ⭐️⭐️⭐️ (FIX) แก้ไข SQL Query ที่นี่ ⭐️⭐️⭐️
                //
                // Error 'Unknown column 'er.room_name'' เกิดขึ้น
                // เราจะเปลี่ยนกลับไปใช้ 'er.name'
                //
                const sql = `
SELECT
    us.id        AS user_session_id,
    u.id         AS user_id,
    u.user_code  AS userCode,
    u.full_name  AS firstName,
    ''           AS lastName,
    er.room_code AS roomName,
    us.qr_payload
FROM user_sessions us
JOIN user_campaigns uc
  ON us.user_campaign_id = uc.id
JOIN users u
  ON uc.user_id = u.id
LEFT JOIN exam_rooms er
  ON er.room_code = uc.room_code
 AND er.campaign_id = uc.campaign_id
WHERE us.session_id = ?;

    `;
                const [rows] = (yield connection.execute(sql, [sessionId]));
                return rows;
            }
            catch (error) {
                console.error("Repo Error (findUserSessions):", error);
                throw error;
            }
            finally {
                connection.release();
            }
        });
    }
    findByUserIdAndSessionId(userId, sessionId, connection) {
        return __awaiter(this, void 0, void 0, function* () {
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
                const [rows] = (yield connection.execute(sql, [userId, sessionId]));
                return rows[0]; // (คืนค่าตัวแรกที่เจอ หรือ undefined)
            }
            catch (error) {
                console.error("Repo Error (findByUserIdAndSessionId):", error);
                throw error;
            }
            // (ไม่ต้อง release connection ที่นี่ เพราะ Service จัดการ)
        });
    }
    ;
    findByUserCodeAndSessionId(userCode, sessionId, connection) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(userCode);
            const sql = `
SELECT 
    us.id              AS user_session_id,
    u.id               AS user_id,
    u.user_code        AS userCode,
    u.first_name       AS firstName,
    u.last_name        AS lastName,
    uc.room_code       AS roomName,
    us.qr_payload,
    uc.row_no as rowNo
FROM user_sessions us
JOIN user_campaigns uc 
  ON us.user_campaign_id = uc.id
  AND us.campaign_id = uc.campaign_id
JOIN users u 
  ON uc.user_id = u.id
WHERE 
    u.user_code =?
    AND us.session_id = ?
LIMIT 1;;
`;
            try {
                const [rows] = (yield connection.execute(sql, [userCode, sessionId]));
                return rows[0];
            }
            catch (error) {
                console.error("Repo Error (findByUserCodeAndSessionId):", error);
                throw error;
            }
        });
    }
    findByUserCodeAndSessionIdForQRcode(userCode, sessionId, connection) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(userCode);
            const sql = `
SELECT 
    us.id              AS userSessionId,
    u.id               AS userId,
    u.title,
    u.user_code        AS userCode,
    u.first_name       AS firstName,
    u.last_name        AS lastName,
    uc.room_code       AS roomName,
    uc.row_no          AS rowNo,

    s.session_code,

    sub.name           AS subjectName,
    ec.name            AS campaignName
FROM user_sessions us
JOIN user_campaigns uc 
  ON us.user_campaign_id = uc.id
  AND us.campaign_id = uc.campaign_id
JOIN users u 
  ON uc.user_id = u.id
JOIN sessions s 
  ON s.id = us.session_id
JOIN session_subjects sj 
  ON sj.session_id = s.id
JOIN subjects sub 
  ON sub.id = sj.subject_id
JOIN exam_campaigns ec 
  ON ec.id = us.campaign_id
WHERE 
    u.user_code = ?
    AND us.session_id = ?
LIMIT 1;
`;
            try {
                const [rows] = (yield connection.execute(sql, [userCode, sessionId]));
                return rows[0];
            }
            catch (error) {
                console.error("Repo Error (findByUserCodeAndSessionId):", error);
                throw error;
            }
        });
    }
    findUserSessionByCampaignSessionAndUserCode(conn, params) {
        return __awaiter(this, void 0, void 0, function* () {
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
            const [rows] = yield conn.execute(sql, [
                campaignId,
                sessionId,
                campaignId,
                userCode,
            ]);
            return rows[0] || null;
        });
    }
    findUserSessionsBatch(conn, campaignId, sessionId, userCodes) {
        return __awaiter(this, void 0, void 0, function* () {
            if (userCodes.length === 0)
                return [];
            // สร้างเครื่องหมาย ?, ?, ? ตามจำนวน userCodes
            const placeholders = userCodes.map(() => '?').join(',');
            const sql = `
        SELECT
            us.id         AS id,
            u.id          AS user_id,
            u.user_code   AS user_code
        FROM users u
        JOIN user_campaigns uc ON uc.user_id = u.id AND uc.campaign_id = ?
        JOIN user_sessions us  ON us.user_campaign_id = uc.id AND us.session_id = ? AND us.campaign_id = ?
        WHERE u.user_code IN (${placeholders})
    `;
            const params = [campaignId, sessionId, campaignId, ...userCodes];
            const [rows] = yield conn.execute(sql, params);
            return rows;
        });
    }
}
const userSessionsRepo = new UserSessionsRepo();
exports.default = userSessionsRepo;
