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
const DB_1 = require("../model/DB"); // (สมมติว่านี่คือไฟล์ DB Pool ของคุณ)
class CampaignRepo {
    constructor() {
        this.pool = DB_1.DB.getInstance();
    }
    create(payload_1) {
        return __awaiter(this, arguments, void 0, function* (payload, dbClient = this.pool) {
            console.log(payload);
            const sql = `
INSERT INTO exam_campaigns
  (year_be, site, campaign_size, name, is_active)
VALUES
  (?, ?, ?, ?, ?);
    `;
            const params = [
                payload.year_be,
                payload.site,
                payload.campaign_size,
                payload.name,
                payload.is_active ? 1 : 1,
            ];
            const [result] = yield dbClient.execute(sql, params);
            const newId = result.insertId;
            return this.findById(newId, dbClient);
        });
    }
    CheckActiveCamp() {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `SELECT * FROM exam_campaigns WHERE is_active = 1;`;
            const [rows] = yield this.pool.execute(sql);
            return rows.length > 0;
        });
    }
    update(payload_1) {
        return __awaiter(this, arguments, void 0, function* (payload, dbClient = this.pool) {
            const sql = `
    UPDATE exam_campaigns
    SET code = ?, 
        name = ?, 
        start_date = ?, 
        end_date = ?, 
        is_active = ?, 
        note = ?
    WHERE id = ?
  `;
            const params = [
                payload.code,
                payload.name,
                payload.start_date,
                payload.end_date,
                payload.is_active,
                payload.note,
                payload.id,
            ];
            yield dbClient.execute(sql, params);
            return this.findById(payload.id, dbClient);
        });
    }
    /**
     * [FIX] อัปเดต 'delete' ให้รับ dbClient (โค้ดนี้ถูกต้องอยู่แล้ว)
     */
    delete(id_1) {
        return __awaiter(this, arguments, void 0, function* (id, dbClient = this.pool) {
            const sql = "DELETE FROM exam_campaigns WHERE id = ?";
            const [result] = yield dbClient.execute(sql, [id]); // 👈 ใช้ dbClient
            return result.affectedRows > 0;
        });
    }
    /**
     * [FIX] อัปเดต 'findById' ให้รับ dbClient (สำหรับ Transaction)
     */
    findById(id_1) {
        return __awaiter(this, arguments, void 0, function* (id, dbClient = this.pool) {
            const sql = "SELECT * FROM exam_campaigns WHERE id = ?";
            const [rows] = yield dbClient.execute(sql, [id]); // 👈 ใช้ dbClient
            if (rows.length === 0) {
                throw new Error(`Campaign with ID ${id} not found.`);
            }
            return rows[0];
        });
    }
    findOrCreateByCode(payload, dbClient) {
        return __awaiter(this, void 0, void 0, function* () {
            const findSql = "SELECT * FROM exam_campaigns WHERE code = ?";
            const [rows] = yield dbClient.execute(findSql, [
                payload.code,
            ]);
            if (rows.length > 0) {
                return { campaign: rows[0], created: false };
            }
            const newCampaign = yield this.create(payload, dbClient);
            return { campaign: newCampaign, created: true };
        });
    }
    getIsDecrypted(campaign_id) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
    SELECT e.is_unlock
    FROM exam_campaigns e
    WHERE e.id = ?
    LIMIT 1
  `;
            const [rows] = yield this.pool.execute(sql, [campaign_id]);
            if (!rows.length) {
                throw new Error("ไม่พบ campaign");
            }
            return rows[0].is_unlock === 1;
        });
    }
    unlockCampaign(campaign_id_1) {
        return __awaiter(this, arguments, void 0, function* (campaign_id, dbClient = this.pool) {
            const sql = `            UPDATE exam_campaigns
             SET is_unlock = 1
             WHERE id = ?`;
            yield dbClient.execute(sql, [campaign_id]);
        });
    }
    IscampaignActive(campaign_id_1) {
        return __awaiter(this, arguments, void 0, function* (campaign_id, dbClient = this.pool) {
            const sql = `
SELECT is_active
    FROM exam_campaigns
    WHERE id = ?
    LIMIT 1;
  `;
            const [rows] = yield dbClient.execute(sql, [campaign_id]);
            return rows[0].is_active === 1;
        });
    }
}
const campaignRepo = new CampaignRepo();
exports.default = campaignRepo;
