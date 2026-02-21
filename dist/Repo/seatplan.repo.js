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
// src/Repo/seatplan.repo.ts
const DB_1 = require("../model/DB");
class SeatPlanRepo {
    constructor() {
        this.pool = DB_1.DB.getInstance();
    }
    // .... ของเดิม generateSeatPlanPdf ใช้อยู่
    findSeatPlanByCampaignAndSession(sessionId, campaignId) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
SELECT
  CONCAT(
    MIN(CAST(u.user_code AS UNSIGNED)),
    ' - ',
    MAX(CAST(u.user_code AS UNSIGNED))
  ) AS rangeLabel,
  uc.room_code AS roomName,
  uc.row_no AS rowNo
FROM user_sessions us
JOIN user_campaigns uc ON us.user_campaign_id = uc.id
JOIN users u ON uc.user_id = u.id
WHERE us.session_id = ?
  AND us.campaign_id = ?
GROUP BY uc.room_code, uc.row_no
ORDER BY 
  uc.room_code IS NULL,   -- ดัน NULL ไปล่างสุด
  uc.room_code,
  uc.row_no;
    `;
            const [rows] = yield this.pool.execute(sql, [sessionId, campaignId]);
            return rows;
        });
    }
    //  ใหม่: รายชื่อผู้เข้าสอบ เรียงตามชื่อ
    findSeatPlanNameListByCampaignAndSession(sessionId, campaignId) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
      SELECT
        u.full_name      AS fullName,
        u.user_code      AS userCode,
        uc.room_code     AS roomName,
        uc.row_no        AS rowNo
      FROM user_sessions us
      JOIN user_campaigns uc ON us.user_campaign_id = uc.id
      JOIN users u           ON uc.user_id = u.id
      WHERE us.session_id = ? AND us.campaign_id = ?
      ORDER BY u.full_name ASC, u.user_code ASC;
    `;
            const [rows] = yield this.pool.execute(sql, [sessionId, campaignId]);
            return rows;
        });
    }
    findSeatPlanNameListByCampaign(campaignId) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
SELECT
        u.full_name      AS fullName,
        u.user_code      AS userCode,
        u.title          AS title,
        uc.room_code     AS roomName,
        uc.row_no        AS rowNo,
        uc.col_no        AS colNo
      FROM user_campaigns uc
      JOIN users u  ON uc.user_id = u.id
      WHERE uc.campaign_id = ?
      ORDER BY u.full_name ASC, u.user_code ASC;;
    `;
            const [rows] = yield this.pool.execute(sql, [campaignId]);
            return rows;
        });
    }
    getExamInfoWithSessions(campaign_id) {
        return __awaiter(this, void 0, void 0, function* () {
            const conn = yield this.pool.getConnection();
            try {
                yield conn.beginTransaction();
                // 1️⃣ exam_campaigns
                const sqlExam = `
      SELECT 
        ec.id,
        ec.name,
        ec.year_be,
        ec.site,
        ec.campaign_size
      FROM exam_campaigns ec
      WHERE ec.id = ?;
    `;
                const [examRows] = yield conn.execute(sqlExam, [campaign_id]);
                const exam = examRows[0];
                if (!exam) {
                    yield conn.rollback();
                    return null;
                }
                // 2️⃣ sessions.exam_date
                const sqlSessions = `
      SELECT s.exam_date
      FROM sessions s
      WHERE s.campaign_id = ?;
    `;
                const [sessionRows] = yield conn.execute(sqlSessions, [campaign_id]);
                yield conn.commit();
                return {
                    exam,
                    dates: sessionRows.map(r => r.exam_date)
                };
            }
            catch (err) {
                yield conn.rollback();
                throw err;
            }
            finally {
                conn.release();
            }
        });
    }
}
const seatPlanRepo = new SeatPlanRepo();
exports.default = seatPlanRepo;
