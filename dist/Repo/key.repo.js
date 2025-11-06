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
// --- Repo Class ---
class KeyRepo {
    constructor() {
        this.pool = DB_1.DB.getInstance();
    }
    /**
     * ค้นหาคีย์ทั้งหมด
     */
    findAllByCampaignId(campaignId_1) {
        return __awaiter(this, arguments, void 0, function* (campaignId, dbClient = this.pool) {
            const sql = "SELECT * FROM campaign_keys WHERE campaign_id = ?";
            const [rows] = yield dbClient.execute(sql, [campaignId]);
            return rows;
        });
    }
    /**
     * นับจำนวนคีย์
     */
    countByCampaignId(campaignId_1) {
        return __awaiter(this, arguments, void 0, function* (campaignId, dbClient = this.pool) {
            const sql = "SELECT COUNT(*) as count FROM campaign_keys WHERE campaign_id = ?";
            const [rows] = yield dbClient.execute(sql, [campaignId]);
            return rows[0].count;
        });
    }
    /**
     * (Helper) ค้นหาด้วย ID
     */
    findById(id_1) {
        return __awaiter(this, arguments, void 0, function* (id, dbClient = this.pool) {
            const sql = "SELECT * FROM campaign_keys WHERE id = ?";
            const [rows] = yield dbClient.execute(sql, [id]);
            return rows[0] || null;
        });
    }
    /**
     * [ ⭐️ 3. Create Key (แก้ไข) ⭐️ ]
     * (key_alias -> key)
     */
    create(payload_1) {
        return __awaiter(this, arguments, void 0, function* (payload, dbClient = this.pool) {
            const sql = `
      INSERT INTO campaign_keys (campaign_id, \`key\`, iv, algor) 
      VALUES (?, ?, ?, ?)
    `;
            const params = [
                payload.campaign_id,
                payload.key, // [ ⭐️ FIX ⭐️ ]
                payload.iv,
                payload.algor,
            ];
            const [result] = yield dbClient.execute(sql, params);
            const newId = result.insertId;
            const newKey = yield this.findById(newId, dbClient);
            if (!newKey) {
                throw new Error("Failed to retrieve newly created key.");
            }
            return newKey;
        });
    }
    /**
     * ลบคีย์
     */
    delete(id_1) {
        return __awaiter(this, arguments, void 0, function* (id, dbClient = this.pool) {
            const sql = "DELETE FROM campaign_keys WHERE id = ?";
            const [result] = yield dbClient.execute(sql, [id]);
            return result.affectedRows > 0;
        });
    }
}
const keyRepo = new KeyRepo();
exports.default = keyRepo;
