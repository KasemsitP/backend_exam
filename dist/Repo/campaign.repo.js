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
            const sql = `
      INSERT INTO exam_campaigns 
        (code, name, start_date, end_date, is_active, note) 
      VALUES (?, ?, ?, ?, ?, ?)
    `;
            const params = [
                payload.code,
                payload.name,
                payload.start_date,
                payload.end_date,
                payload.is_active,
                payload.note,
            ];
            const [result] = yield dbClient.execute(sql, params); // 👈 ใช้ dbClient
            const newId = result.insertId;
            return this.findById(newId, dbClient); // 👈 ส่ง dbClient ต่อ
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
}
const campaignRepo = new CampaignRepo();
exports.default = campaignRepo;
