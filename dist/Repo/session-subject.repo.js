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
class SessionSubjectRepo {
    constructor() {
        this.pool = DB_1.DB.getInstance();
    }
    /**
     * สร้างการเชื่อมโยง (Link) ในตาราง session_subjects
     * (ฟังก์ชันนี้รับ POJO ที่ Service สร้างขึ้น)
     */
    create(payload_1) {
        return __awaiter(this, arguments, void 0, function* (payload, // 👈 (รับ POJO)
        dbClient = this.pool) {
            const sql = `
      INSERT INTO session_subjects 
        (session_id, subject_id, start_at, end_at, 
         question_count, question_range, order_no)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
            const params = [
                payload.session_id,
                payload.subject_id,
                payload.start_at,
                payload.end_at,
                payload.question_count,
                payload.question_range || null, // (ป้องกัน undefined)
                payload.order_no || 1, // (ป้องกัน undefined/0)
            ];
            yield dbClient.execute(sql, params);
            // คืนค่าข้อมูลที่ Join ตาราง subjects แล้ว
            return this.findByIds(payload.session_id, payload.subject_id, dbClient);
        });
    }
    /**
     * ค้นหาโดยใช้ Composite Key (และ Join ตาราง subjects)
     */
    findByIds(sessionId_1, subjectId_1) {
        return __awaiter(this, arguments, void 0, function* (sessionId, subjectId, dbClient = this.pool) {
            const sql = `
      SELECT 
        ss.*, 
        s.code, 
        s.name 
      FROM 
        session_subjects ss
      JOIN 
        subjects s ON ss.subject_id = s.id
      WHERE 
        ss.session_id = ? AND ss.subject_id = ?
    `;
            const [rows] = yield dbClient.execute(sql, [
                sessionId,
                subjectId,
            ]);
            if (rows.length === 0) {
                throw new Error(`SessionSubject link (S:${sessionId}, Sub:${subjectId}) not found.`);
            }
            return rows[0];
        });
    }
    /**
     * ลบโดยใช้ Composite Key (รองรับ Thunk 'deleteSubjectThunk')
     */
    deleteByIds(sessionId_1, subjectId_1) {
        return __awaiter(this, arguments, void 0, function* (sessionId, subjectId, dbClient = this.pool) {
            const sql = "DELETE FROM session_subjects WHERE session_id = ? AND subject_id = ?";
            const [result] = yield dbClient.execute(sql, [sessionId, subjectId]);
            return result.affectedRows > 0;
        });
    }
    countReferencesBySubjectId(subjectId_1) {
        return __awaiter(this, arguments, void 0, function* (subjectId, dbClient = this.pool) {
            const sql = "SELECT COUNT(*) as count FROM session_subjects WHERE subject_id = ?";
            const [rows] = yield dbClient.execute(sql, [subjectId]);
            return rows[0].count;
        });
    }
    findNumberofQuestion(subjectId) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `SELECT 
    s.id AS subject_id,
    s.code AS subject_code,
    COUNT(q.id) AS total_questions
FROM subjects s
LEFT JOIN subject_questions q ON s.id = q.subject_id
WHERE s.id = ?
GROUP BY s.id, s.code, s.name`;
            const [rows] = yield this.pool.execute(sql, [subjectId]);
            return rows[0];
        });
    }
    CheckHasSubjects(session_id_1) {
        return __awaiter(this, arguments, void 0, function* (session_id, dbClient = this.pool) {
            const sql = `SELECT * FROM session_subjects where session_id = ?;`;
            const [rows] = yield dbClient.execute(sql, [session_id]);
            return rows.length > 0;
        });
    }
    CheckDubplicateSubject(session_id_1, subject_id_1) {
        return __awaiter(this, arguments, void 0, function* (session_id, subject_id, dbClient = this.pool) {
            const sql2 = `select s.campaign_id from sessions s where id = ?;`;
            const [rows2] = yield dbClient.execute(sql2, [session_id]);
            if (rows2.length === 0) {
                throw new Error(`ไม่พบ session_id: ${session_id} ในตาราง sessions`);
            }
            const campaign_id = rows2[0].campaign_id;
            const sql = `SELECT 1
FROM session_subjects ss
WHERE ss.subject_id = ?
AND ss.session_id IN (
    SELECT s.id
    FROM sessions s
    WHERE s.campaign_id = ?
)
LIMIT 1;`;
            const [rows] = yield dbClient.execute(sql, [subject_id, campaign_id]);
            return rows.length > 0;
        });
    }
    IsLinkedToSession(campaign_id) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `SELECT ss.session_id FROM session_subjects ss JOIN sessions s ON s.id = ss.session_id  WHERE s.campaign_id = ?;`;
            const [rows] = yield this.pool.execute(sql, [campaign_id]);
            return rows.length > 0;
        });
    }
}
const sessionSubjectRepo = new SessionSubjectRepo();
exports.default = sessionSubjectRepo;
