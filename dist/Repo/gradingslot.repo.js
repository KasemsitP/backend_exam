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
    findBookletForUser(conn, campaignId, sessionId, userCode) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
SELECT
    b.id              AS booklet_id,
    b.user_session_id AS user_session_id,
    us.user_campaign_id,
    us.qr_payload,          -- เพิ่มตรงนี้
    u.id              AS user_id,
    u.user_code       AS user_code,
    bg.id              AS bag_id,
    bg.bag_no          AS bag_no
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
JOIN bags bg ON bg.id = b.bag_id 
WHERE u.user_code = ?
LIMIT 1;
    `;
            const params = [campaignId, sessionId, campaignId, userCode];
            const [rows] = yield conn.execute(sql, params);
            return rows[0] || null;
        });
    }
    /**
     * ดึง slot ทั้งหมดของกระดาษใบนี้ + ข้อนี้
     * ถ้า forUpdate = true จะ FOR UPDATE (ใช้ใน transaction)
     */
    findSlotsByBookletAndQuestion(conn_1, bookletId_1, subjectId_1, questionNo_1) {
        return __awaiter(this, arguments, void 0, function* (conn, bookletId, subjectId, questionNo, forUpdate = false) {
            const sql = `
      SELECT id, booklet_id, subject_id, question_no, grader_order, status, grader_id
      FROM grading_slots
      WHERE booklet_id = ? AND subject_id = ? AND question_no = ?
      ${forUpdate ? "FOR UPDATE" : ""}
    `;
            const [rows] = yield conn.execute(sql, [
                bookletId,
                subjectId,
                questionNo,
            ]);
            return rows;
        });
    }
    findSlotsByBookletAndQuestionAndScore(conn_1, bookletId_1, subjectId_1, questionNo_1) {
        return __awaiter(this, arguments, void 0, function* (conn, bookletId, subjectId, questionNo, forUpdate = false) {
            const sql = `
SELECT 
  gs.id,
  gs.booklet_id,
  gs.subject_id,
  gs.question_no,
  gs.grader_order,
  gs.status,
  gs.grader_id,
  gsc.score
  
FROM grading_slots gs
LEFT JOIN grading_scores gsc ON gsc.slot_id = gs.id
WHERE gs.booklet_id = ? 
  AND gs.subject_id = ? 
  AND gs.question_no = ?
  ORDER BY grader_order;
      ${forUpdate ? "FOR UPDATE" : ""}
    `;
            const [rows] = yield conn.execute(sql, [
                bookletId,
                subjectId,
                questionNo,
            ]);
            return rows;
        });
    }
    /**
     * สร้าง slot ใหม่ให้ผู้ตรวจ (status = 'ASSIGNED')
     */
    insertSlot(conn, bookletId, subjectId, questionNo, graderOrder, graderId) {
        return __awaiter(this, void 0, void 0, function* () {
            const insertSql = `
      INSERT INTO grading_slots (
        booklet_id,
        subject_id,
        question_no,
        grader_order,
        status,
        grader_id
      )
      VALUES (?, ?, ?, ?, 'ASSIGNED', ?)
    `;
            const [result] = yield conn.execute(insertSql, [
                bookletId,
                subjectId,
                questionNo,
                graderOrder,
                graderId,
            ]);
            const newId = result.insertId;
            const [rows] = yield conn.execute(`
      SELECT id, booklet_id, subject_id, question_no, grader_order, status, grader_id
      FROM grading_slots
      WHERE id = ?
      `, [newId]);
            if (!rows[0]) {
                throw new Error("ไม่พบ slot ที่เพิ่งสร้าง");
            }
            return rows[0];
        });
    }
    //ยังไม่มีใช้นะ
    findAssignmentForGraderInSession(conn, graderId, sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const [rows] = yield conn.query(`
      SELECT 
        ga.grader_id,
        ga.session_id,
        ga.subject_id,
        ga.subject_question_id,
        sq.question_no,
        sq.label AS question_label
      FROM grader_assignments ga
      JOIN subject_questions sq
        ON ga.subject_question_id = sq.id
      WHERE ga.grader_id = ?
        AND ga.session_id = ?
    `, [graderId, sessionId]);
            // กรณี 1 grader มีได้แค่ 1 ข้อใน 1 session (ตามที่คุณเลือก)
            return (_a = rows) !== null && _a !== void 0 ? _a : null;
        });
    }
    findUnscoredSlotForGrader(conn, bookletId, subjectId, questionNo, graderId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const sql = `
      SELECT s.*
      FROM grading_slots s
      LEFT JOIN grading_scores gs
        ON gs.slot_id = s.id
      WHERE s.booklet_id = ?
        AND s.subject_id = ?
        AND s.question_no = ?
        AND s.grader_id  = ?
        AND gs.id IS NULL         -- ยังไม่มีคะแนนเลย
      LIMIT 1
      FOR UPDATE
    `;
            const [rows] = yield conn.execute(sql, [
                bookletId,
                subjectId,
                questionNo,
                graderId,
            ]);
            return (_a = rows[0]) !== null && _a !== void 0 ? _a : null;
        });
    }
}
const gradingslotRepo = new GradingslotRepo();
exports.default = gradingslotRepo;
