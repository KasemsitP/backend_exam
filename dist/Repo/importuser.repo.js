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
// (Helper Finders - เหมือนเดิม)
class UserImportRepo {
    constructor() {
        this.pool = DB_1.DB.getInstance();
    }
    /** (Helper) ค้นหา User ด้วย ID */
    findById(id, dbClient) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = "SELECT * FROM users WHERE id = ?";
            const [rows] = yield dbClient.execute(sql, [id]);
            return rows[0] || null;
        });
    }
    /** (Helper) ค้นหา UserCampaign ด้วย ID */
    findUserCampaignById(id, dbClient) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = "SELECT * FROM user_campaigns WHERE id = ?";
            const [rows] = yield dbClient.execute(sql, [id]);
            return rows[0] || null;
        });
    }
    /** (Helper) ค้นหา UserSession ด้วย ID */
    findUserSessionById(id, dbClient) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = "SELECT * FROM user_sessions WHERE id = ?";
            const [rows] = yield dbClient.execute(sql, [id]);
            return rows[0] || null;
        });
    }
    findOrCreateUser(payload, dbClient) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
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
            const [result] = yield dbClient.execute(sql, [
                payload.user_code,
                payload.full_name,
                payload.first_name,
                payload.last_name,
                payload.title,
                (_a = payload.national_id) !== null && _a !== void 0 ? _a : null,
                (_b = payload.birth_date) !== null && _b !== void 0 ? _b : null,
            ]);
            const created = result.affectedRows === 1; // 1 = insert ใหม่, 2 = update
            const newId = result.insertId;
            const user = yield this.findById(newId, dbClient);
            if (!user) {
                throw new Error("Failed to retrieve user after upsert.");
            }
            return { user, created };
        });
    }
    findOrCreateUserCampaign(payload, dbClient) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
    INSERT INTO user_campaigns (user_id, campaign_id)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE
      id = LAST_INSERT_ID(id)
  `;
            const [result] = yield dbClient.execute(sql, [
                payload.user_id,
                payload.campaign_id,
            ]);
            const created = result.affectedRows === 1;
            const newId = result.insertId;
            const userCampaign = yield this.findUserCampaignById(newId, dbClient);
            if (!userCampaign) {
                throw new Error("Failed to retrieve user_campaign after upsert.");
            }
            return { userCampaign, created };
        });
    }
    findOrCreateUserSession(payload, dbClient) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
    INSERT INTO user_sessions (user_campaign_id, session_id, campaign_id)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE
      id = LAST_INSERT_ID(id)
  `;
            const [result] = yield dbClient.execute(sql, [
                payload.user_campaign_id,
                payload.session_id,
                payload.campaign_id,
            ]);
            const created = result.affectedRows === 1;
            const newId = result.insertId;
            const userSession = yield this.findUserSessionById(newId, dbClient);
            if (!userSession) {
                throw new Error("Failed to retrieve user_session after upsert.");
            }
            return { userSession, created };
        });
    }
    countByCampaignId(campaignId_1) {
        return __awaiter(this, arguments, void 0, function* (campaignId, dbClient = this.pool) {
            const sql = "SELECT COUNT(*) as count FROM user_campaigns WHERE campaign_id = ?";
            const [rows] = yield dbClient.execute(sql, [campaignId]);
            return rows[0].count;
        });
    }
    findAllUserLinksForSession(sessionId_1) {
        return __awaiter(this, arguments, void 0, function* (sessionId, dbClient = this.pool) {
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
            const [rows] = yield dbClient.execute(sql, [sessionId]);
            return rows;
        });
    }
    /**
     * [ ⭐️ นี่คือฟังก์ชันที่ถูกต้อง ⭐️ ]
     * อัปเดต qr_payload ในตาราง user_sessions
     */
    updateQrPayload(userSessionId_1, qrPayload_1) {
        return __awaiter(this, arguments, void 0, function* (userSessionId, qrPayload, dbClient = this.pool) {
            const sql = "UPDATE user_sessions SET qr_payload = ? WHERE id = ?";
            const [result] = yield dbClient.execute(sql, [
                qrPayload,
                userSessionId,
            ]);
            if (result.affectedRows === 0) {
                throw new Error(`Failed to update qr_payload: user_session_id ${userSessionId} not found.`);
            }
            return true;
        });
    }
    findMaxUserCodeByCampaign(campaignId_1) {
        return __awaiter(this, arguments, void 0, function* (campaignId, dbClient = this.pool) {
            var _a, _b;
            const sql = `
    SELECT 
      COALESCE(MAX(CAST(u.user_code AS UNSIGNED)), 0) AS max_user_code
    FROM users u
    JOIN user_campaigns uc ON u.id = uc.user_id
    WHERE uc.campaign_id = ?
  `;
            const [rows] = yield dbClient.execute(sql, [campaignId]);
            const max = Number((_b = (_a = rows[0]) === null || _a === void 0 ? void 0 : _a.max_user_code) !== null && _b !== void 0 ? _b : 0);
            return max;
        });
    }
    findPreviousNumber(campaignId_1) {
        return __awaiter(this, arguments, void 0, function* (campaignId, dbClient = this.pool) {
            var _a, _b;
            const sql = `
SELECT count(uc.id) as count from user_campaigns uc WHERE uc.campaign_id = ?;
  `;
            const [rows] = yield dbClient.execute(sql, [campaignId]);
            const max = Number((_b = (_a = rows[0]) === null || _a === void 0 ? void 0 : _a.count) !== null && _b !== void 0 ? _b : 0);
            return max;
        });
    }
    // test optimized
    bulkUpsertUsers(usersData, dbClient) {
        return __awaiter(this, void 0, void 0, function* () {
            if (usersData.length === 0)
                return [];
            // เตรียม Array ซ้อน Array สำหรับ VALUES ?
            const values = usersData.map((u) => {
                var _a, _b;
                return [
                    u.userCode,
                    u.fullName,
                    u.firstName,
                    u.lastName,
                    u.title,
                    (_a = u.nationalId) !== null && _a !== void 0 ? _a : null,
                    (_b = u.birthDate) !== null && _b !== void 0 ? _b : null,
                ];
            });
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
            yield dbClient.query(sql, [values]);
            // เนื่องจาก MySQL ไม่รองรับ RETURNING เราจึงต้อง SELECT กลับมาด้วย user_code
            const userCodes = usersData.map((u) => u.userCode);
            const fetchSql = `SELECT id, user_code FROM users WHERE user_code IN (?)`;
            const [rows] = yield dbClient.query(fetchSql, [userCodes]);
            return rows;
        });
    }
    bulkInsertUserCampaigns(campaignData, dbClient) {
        return __awaiter(this, void 0, void 0, function* () {
            if (campaignData.length === 0)
                return [];
            const values = campaignData.map((c) => [c.userId, c.campaignId]);
            // ใช้ INSERT IGNORE เพื่อข้ามถ้าคนนี้เคยผูก Campaign นี้ไปแล้ว
            const sql = `INSERT IGNORE INTO user_campaigns (user_id, campaign_id) VALUES ?`;
            yield dbClient.query(sql, [values]);
            // SELECT IDs กลับมาเพื่อไปผูกกับ Sessions ต่อ
            const userIds = campaignData.map((c) => c.userId);
            const campaignId = campaignData[0].campaignId;
            const fetchSql = `SELECT id, user_id FROM user_campaigns WHERE campaign_id = ? AND user_id IN (?)`;
            const [rows] = yield dbClient.query(fetchSql, [campaignId, userIds]);
            return rows;
        });
    }
    bulkInsertUserSessions(sessionData, dbClient) {
        return __awaiter(this, void 0, void 0, function* () {
            if (sessionData.length === 0)
                return 0;
            const values = sessionData.map((s) => [s.userCampaignId, s.sessionId, s.campaignId]);
            const sql = `INSERT IGNORE INTO user_sessions (user_campaign_id, session_id, campaign_id) VALUES ?`;
            const [result] = yield dbClient.query(sql, [values]);
            return result.affectedRows; // คืนค่าจำนวนแถวที่ถูกสร้างสำเร็จ
        });
    }
}
const userImportRepo = new UserImportRepo();
exports.default = userImportRepo;
