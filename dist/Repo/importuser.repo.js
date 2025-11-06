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
    // (findOrCreateUser - เหมือนเดิม)
    findOrCreateUser(payload, dbClient) {
        return __awaiter(this, void 0, void 0, function* () {
            const findSql = "SELECT * FROM users WHERE user_code = ?";
            const [rows] = yield dbClient.execute(findSql, [
                payload.user_code,
            ]);
            if (rows.length > 0) {
                return { user: rows[0], created: false };
            }
            const insertSql = "INSERT INTO users (user_code, full_name) VALUES (?, ?)";
            const [result] = yield dbClient.execute(insertSql, [
                payload.user_code,
                payload.full_name,
            ]);
            const newUser = yield this.findById(result.insertId, dbClient);
            if (!newUser) {
                throw new Error("Failed to retrieve newly created user.");
            }
            return { user: newUser, created: true };
        });
    }
    // (findOrCreateUserCampaign - เหมือนเดิม)
    findOrCreateUserCampaign(payload, dbClient) {
        return __awaiter(this, void 0, void 0, function* () {
            const findSql = "SELECT * FROM user_campaigns WHERE user_id = ? AND campaign_id = ?";
            const [rows] = yield dbClient.execute(findSql, [
                payload.user_id,
                payload.campaign_id,
            ]);
            if (rows.length > 0) {
                return { userCampaign: rows[0], created: false };
            }
            const insertSql = "INSERT INTO user_campaigns (user_id, campaign_id) VALUES (?, ?)";
            const [result] = yield dbClient.execute(insertSql, [
                payload.user_id,
                payload.campaign_id,
            ]);
            const newUserCampaign = yield this.findUserCampaignById(result.insertId, dbClient);
            if (!newUserCampaign) {
                throw new Error("Failed to retrieve newly created user_campaign.");
            }
            return { userCampaign: newUserCampaign, created: true };
        });
    }
    // [ ⭐️ นี่คือจุดที่แก้ไข ⭐️ ]
    // (แก้ปัญหา Error: ts(2353))
    findOrCreateUserSession(
    // (1. เพิ่ม 'site_id' เข้าไปใน Type)
    payload, dbClient) {
        return __awaiter(this, void 0, void 0, function* () {
            const findSql = "SELECT * FROM user_sessions WHERE user_campaign_id = ? AND session_id = ?";
            const [rows] = yield dbClient.execute(findSql, [
                payload.user_campaign_id,
                payload.session_id,
            ]);
            if (rows.length > 0) {
                return { userSession: rows[0], created: false };
            }
            // (2. เพิ่ม site_id ใน SQL)
            const insertSql = "INSERT INTO user_sessions (user_campaign_id, session_id, campaign_id, site_id) VALUES (?, ?, ?, ?)"; // 👈 (4 ?)
            // (3. เพิ่ม site_id ใน Params)
            const [result] = yield dbClient.execute(insertSql, [
                payload.user_campaign_id,
                payload.session_id,
                payload.campaign_id,
                payload.site_id, // 👈 (เพิ่ม)
            ]);
            const newUserSession = yield this.findUserSessionById(result.insertId, dbClient);
            if (!newUserSession) {
                throw new Error("Failed to retrieve newly created user_session.");
            }
            return { userSession: newUserSession, created: true };
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
}
const userImportRepo = new UserImportRepo();
exports.default = userImportRepo;
