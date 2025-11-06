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
                const [rows] = (yield connection.execute(sql, [userCode, sessionId]));
                return rows[0];
            }
            catch (error) {
                console.error("Repo Error (findByUserCodeAndSessionId):", error);
                throw error;
            }
        });
    }
}
const userSessionsRepo = new UserSessionsRepo();
exports.default = userSessionsRepo;
