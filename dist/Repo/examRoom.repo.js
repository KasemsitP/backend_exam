"use strict";
// src/Repo/examRoom.repo.ts
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
class ExamRoomRepo {
    constructor() {
        this.pool = DB_1.DB.getInstance();
    }
    findByCampaignId(campaignId, connection) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = "SELECT campaign_id, room_code, capacity FROM exam_rooms WHERE campaign_id = ? ORDER BY room_code ASC;";
            try {
                const [rows] = yield connection.execute(sql, [
                    campaignId,
                ]);
                return rows;
            }
            catch (error) {
                console.error("Repo Error (Room FindByCampaign):", error);
                throw error;
            }
        });
    }
    findByCampaignIdCon(campaignId) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = "SELECT campaign_id, room_code, capacity FROM exam_rooms WHERE campaign_id = ? ORDER BY room_code ASC;";
            try {
                const [rows] = yield this.pool.execute(sql, [
                    campaignId,
                ]);
                return rows;
            }
            catch (error) {
                console.error("Repo Error (Room FindByCampaign):", error);
                throw error;
            }
        });
    }
    // Insert หรือ Update ห้องสอบ (ต่อ campaign)
    upsert(data, connection) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
      INSERT INTO exam_rooms (campaign_id, room_code, capacity)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE capacity = VALUES(capacity);
    `;
            try {
                const [result] = yield connection.execute(sql, [
                    data.campaign_id,
                    data.room_code,
                    data.capacity,
                ]);
                return result;
            }
            catch (error) {
                console.error("Repo Error (Room Upsert):", error);
                throw error;
            }
        });
    }
    IsDubpliateCode(campaign_id_1, room_code_1) {
        return __awaiter(this, arguments, void 0, function* (campaign_id, room_code, connection = this.pool) {
            const sql = `
    select 1 from exam_rooms where campaign_id = ? and room_code = ? limit 1;
    `;
            const [rows] = yield connection.execute(sql, [
                campaign_id,
                room_code,
            ]);
            return rows.length > 0; // true if duplicate exists
        });
    }
    // ลบห้องสอบของ campaign นั้น ๆ
    delete(campaignId, roomCode, connection) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = "DELETE FROM exam_rooms WHERE campaign_id = ? AND room_code = ?;";
            try {
                const [result] = yield connection.execute(sql, [campaignId, roomCode]);
                return result;
            }
            catch (error) {
                console.error("Repo Error (Room Delete):", error);
                throw error;
            }
        });
    }
    isAssigned(campaignId, roomCode, connection) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
    SELECT COUNT(us.id) AS countnum
    FROM user_campaigns us
    WHERE us.room_code = ?
      AND us.campaign_id = ?
  `;
            try {
                const [rows] = yield connection.execute(sql, [roomCode, campaignId]);
                return rows[0].countnum > 0;
            }
            catch (error) {
                console.error("assigned already", error);
                throw error;
            }
        });
    }
}
const examRoomRepo = new ExamRoomRepo();
exports.default = examRoomRepo;
