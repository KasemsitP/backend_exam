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
class GradingslotRepo {
    /**
     * หา booklet_subject สำหรับผู้เข้าสอบ 1 คน ใน campaign+session+subject ที่กำหนด
     * ใช้จาก decoded QR => {cid, sid, uid} + subjectId
     */
    findBookletSubjectForUser(conn, campaignId, sessionId, subjectId, userCode) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
      SELECT
        bs.id             AS booklet_subject_id,
        bs.booklet_id     AS booklet_id,
        b.user_session_id AS user_session_id,
        us.user_campaign_id,
        u.id              AS user_id,
        u.user_code       AS user_code
      FROM users u
      JOIN user_campaigns uc
        ON uc.user_id = u.id
        AND uc.campaign_id = ?
      JOIN user_sessions us
        ON us.user_campaign_id = uc.id
        AND us.session_id = ?
        AND us.campaign_id = ?
      JOIN booklets b
        ON b.user_session_id = us.id
      JOIN booklet_subjects bs
        ON bs.booklet_id = b.id
        AND bs.subject_id = ?
        AND bs.session_id = ?
      WHERE u.user_code = ?
      LIMIT 1;
    `;
            const params = [
                campaignId,
                sessionId,
                campaignId,
                subjectId,
                sessionId,
                userCode,
            ];
            const [rows] = yield conn.execute(sql, params);
            return rows[0] || null;
        });
    }
    /**
     * ดึง slot ทั้งหมดของกระดาษใบนี้ + ข้อนี้
     * ถ้า forUpdate = true จะ FOR UPDATE (ใช้ใน transaction)
     */
    findSlotsByBookletAndQuestion(conn_1, bookletSubjectId_1, questionNo_1) {
        return __awaiter(this, arguments, void 0, function* (conn, bookletSubjectId, questionNo, forUpdate = false) {
            const sql = `
      SELECT id, booklet_subject_id, question_no, grader_order, status, grader_id
      FROM grading_slots
      WHERE booklet_subject_id = ? AND question_no = ?
      ${forUpdate ? "FOR UPDATE" : ""}
    `;
            const [rows] = yield conn.execute(sql, [
                bookletSubjectId,
                questionNo,
            ]);
            return rows;
        });
    }
    /**
     * สร้าง slot ใหม่ให้ผู้ตรวจ (status = 'ASSIGNED')
     */
    insertSlot(conn, bookletSubjectId, questionNo, graderOrder, graderId) {
        return __awaiter(this, void 0, void 0, function* () {
            const insertSql = `
      INSERT INTO grading_slots (
        booklet_subject_id,
        question_no,
        grader_order,
        status,
        grader_id
      )
      VALUES (?, ?, ?, 'ASSIGNED', ?)
    `;
            const [result] = yield conn.execute(insertSql, [
                bookletSubjectId,
                questionNo,
                graderOrder,
                graderId,
            ]);
            const newId = result.insertId;
            const [rows] = yield conn.execute(`
      SELECT id, booklet_subject_id, question_no, grader_order, status, grader_id
      FROM grading_slots
      WHERE id = ?
      `, [newId]);
            if (!rows[0]) {
                throw new Error("ไม่พบ slot ที่เพิ่งสร้าง");
            }
            return rows[0];
        });
    }
}
const gradingslotRepo = new GradingslotRepo();
exports.default = gradingslotRepo;
