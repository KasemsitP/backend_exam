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
class SessionRepo {
    constructor() {
        this.pool = DB_1.DB.getInstance();
    }
    create(payload_1) {
        return __awaiter(this, arguments, void 0, function* (payload, dbClient = this.pool) {
            const sql = `
      INSERT INTO sessions 
        (campaign_id, session_code, title, exam_date, day_no) 
      VALUES (?, ?, ?, ?, ?)
    `;
            const params = [
                payload.campaign_id,
                payload.session_code,
                payload.title,
                payload.exam_date,
                payload.day_no,
            ];
            const [result] = yield dbClient.execute(sql, params);
            const newId = result.insertId;
            return this.findById(newId, dbClient);
        });
    }
    checkisDuplicateSessionCode(session_code_1, campaign_id_1) {
        return __awaiter(this, arguments, void 0, function* (session_code, campaign_id, dbClient = this.pool) {
            const sql = `SELECT 1 FROM sessions WHERE session_code = ? AND campaign_id = ? LIMIT 1`;
            const [rows] = yield dbClient.execute(sql, [session_code, campaign_id]);
            return rows.length > 0;
        });
    }
    findById(id_1) {
        return __awaiter(this, arguments, void 0, function* (id, dbClient = this.pool) {
            const sql = "SELECT * FROM sessions WHERE id = ?";
            const [rows] = yield dbClient.execute(sql, [id]);
            if (rows.length === 0) {
                throw new Error(`Session with ID ${id} not found.`);
            }
            return rows[0];
        });
    }
    deleteByCampaignId(campaignId_1) {
        return __awaiter(this, arguments, void 0, function* (campaignId, dbClient = this.pool) {
            const sql = "DELETE FROM sessions WHERE campaign_id = ?";
            const [result] = yield dbClient.execute(sql, [campaignId]);
            // ไม่จำเป็นต้องเช็ค affectedRows เพราะถ้าไม่มี session ให้ลบ (0 rows)
            // ก็ไม่ถือว่าเป็น Error
            return true;
        });
    }
    /**
     * (โค้ดเดิม)
     * ลบ Session เดียว (รองรับ Transaction)
     */
    delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const connection = yield this.pool.getConnection();
            try {
                yield connection.beginTransaction();
                // 1️⃣ ลบ child
                yield connection.execute("DELETE FROM session_subjects WHERE session_id = ?", [id]);
                // 2️⃣ ลบ parent
                const [result] = yield connection.execute("DELETE FROM sessions WHERE id = ?", [id]);
                yield connection.commit();
                return result.affectedRows > 0;
            }
            catch (error) {
                yield connection.rollback();
                throw error;
            }
            finally {
                connection.release(); // สำคัญมาก
            }
        });
    }
    findAllLiteByCampaignId(campaignId_1) {
        return __awaiter(this, arguments, void 0, function* (campaignId, dbClient = this.pool) {
            const sql = "SELECT id FROM sessions WHERE campaign_id = ?";
            const [rows] = yield dbClient.execute(sql, [
                campaignId,
            ]);
            // (แปลงผลลัพธ์ให้ถูกต้อง)
            return rows.map(row => ({
                id: row.id,
            }));
        });
    }
    update(payload_1) {
        return __awaiter(this, arguments, void 0, function* (payload, dbClient = this.pool) {
            const sql = `
      UPDATE sessions
      SET  exam_date = ?
      WHERE id = ?
    `;
            const params = [
                payload.exam_date,
                payload.id,
            ];
            yield dbClient.execute(sql, params);
            return this.findById(payload.id);
        });
    }
}
const sessionRepo = new SessionRepo();
exports.default = sessionRepo;
