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
// src/Repo/gradingscore.repo.ts
const DB_1 = require("../model/DB");
class GradingScoreRepo {
    constructor() {
        this.pool = DB_1.DB.getInstance();
    }
    verifySlotContext(conn, params) {
        return __awaiter(this, void 0, void 0, function* () {
            const { slotId, campaignId, sessionId, subjectId, questionNo, graderId, } = params;
            const sql = `
      SELECT
        s.id AS slot_id
      FROM grading_slots s
      JOIN booklets b
        ON s.booklet_id = b.id
      JOIN user_sessions us
        ON b.user_session_id = us.id
      WHERE s.id = ?
        AND s.question_no = ?
        AND s.subject_id = ?
        AND us.campaign_id = ?
        AND us.session_id = ?
        AND s.grader_id = ?
      LIMIT 1;
    `;
            const paramsArr = [
                slotId,
                questionNo,
                subjectId,
                campaignId,
                sessionId,
                graderId,
            ];
            const [rows] = yield conn.execute(sql, paramsArr);
            return rows.length > 0;
        });
    }
    /**
     * INSERT ลง grading_scores
     * คืน id ที่พึ่ง insert มา
     */
    insertScore(conn, slotId, score, graderId) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
      INSERT INTO grading_scores (slot_id, score, entered_by)
      VALUES (?, ?, ?)
    `;
            const [result] = yield conn.execute(sql, [
                slotId,
                score,
                graderId,
            ]);
            return result.insertId;
        });
    }
    /**
     * อัปเดตสถานะของ slot (เช่น COMPLETED / DISPUTED ฯลฯ)
     */
    updateSlotStatus(conn, slotId, status) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
      UPDATE grading_slots
      SET status = ?
      WHERE id = ?
    `;
            yield conn.execute(sql, [status, slotId]);
        });
    }
    /**
     * ดึงข้อมูลคะแนนที่เพิ่งบันทึก พร้อม join ไปเอาชื่อ grader และ status ของ slot
     */
    findScoreById(conn, gradingScoreId) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
      SELECT
        gs.id        AS gradingscoreId,
        gs.slot_id   AS slotId,
        gs.score     AS score,
        s.status     AS status,
        gs.entered_at AS enteredAt,
        g.id         AS graderId,
        COALESCE(a.full_name, CONCAT('Grader #', g.id)) AS graderName
      FROM grading_scores gs
      JOIN grading_slots s
        ON gs.slot_id = s.id
      JOIN graders g
        ON gs.entered_by = g.id
      LEFT JOIN accounts a
        ON g.account_id = a.id
      WHERE gs.id = ?
      LIMIT 1;
    `;
            const [rows] = yield conn.execute(sql, [gradingScoreId]);
            return rows[0] || null;
        });
    }
    FindAllRecord(grader_id) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
      SELECT 
    g.slot_id,
    g.score,
    g.entered_at
FROM grading_scores g
WHERE g.entered_by = ?
ORDER BY g.entered_at DESC

LIMIT 0, 25;
    `;
            const [rows] = yield this.pool.execute(sql, [grader_id]);
            return rows.length ? rows : null;
        });
    }
}
const gradingscoreRepo = new GradingScoreRepo();
exports.default = gradingscoreRepo;
