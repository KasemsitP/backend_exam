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
        // @ts-ignore ปล่อยให้ตรงกับ implementation เดิมของคุณ
        this.pool = DB_1.DB.getInstance();
    }
    verifySlotContext(conn, params) {
        return __awaiter(this, void 0, void 0, function* () {
            const { slotId, campaignId, graderId } = params;
            // ✅ แก้ไข: JOIN sessions แทน user_sessions เพื่อหา campaign_id
            const sql = `
      SELECT
        s.id AS slot_id
      FROM grading_slots s
      JOIN booklets b
        ON s.booklet_id = b.id
      JOIN sessions sess
        ON b.session_id = sess.id
      WHERE s.id = ?
        AND sess.campaign_id = ?
        AND s.grader_id = ?
      LIMIT 1;
    `;
            const paramsArr = [slotId, campaignId, graderId];
            const [rows] = yield conn.execute(sql, paramsArr);
            return rows.length > 0;
        });
    }
    CheckScore(conn, params) {
        return __awaiter(this, void 0, void 0, function* () {
            const { slotId, question_no, graderId } = params;
            const sql = `
      SELECT sq.question_no , sq.label , sq.max_score 
      FROM subject_questions sq 
      JOIN subjects s ON s.id = sq.subject_id 
      JOIN grading_slots gs ON gs.subject_id = s.id 
      WHERE gs.id = ? AND sq.question_no = ? AND gs.grader_id = ?;
    `;
            const paramsArr = [slotId, question_no, graderId];
            const [rows] = yield conn.execute(sql, paramsArr);
            return rows[0] || null;
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
        gs.id         AS gradingscoreId,
        gs.slot_id    AS slotId,
        gs.score      AS score,
        s.status      AS status,
        gs.entered_at AS enteredAt,
        g.id          AS graderId,
        bk.random_num,
        COALESCE(a.full_name, CONCAT('Grader #', g.id)) AS graderName
      FROM grading_scores gs
      JOIN grading_slots s
        ON gs.slot_id = s.id
      JOIN booklets bk ON bk.id = s.booklet_id
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
        b.random_num,
        g.slot_id,
        g.score,
        g.entered_at AS enteredAT,
        b.qr_payload
      FROM grading_scores g
      JOIN grading_slots gs 
        ON gs.id = g.slot_id
      JOIN booklets b 
        ON b.id = gs.booklet_id
      WHERE g.entered_by = ?
      ORDER BY g.entered_at DESC
      LIMIT 25 OFFSET 0;
    `;
            const [rows] = yield this.pool.execute(sql, [grader_id]);
            return rows;
        });
    }
    /**
     * ใช้ตอน recheck:
     * จาก slotId → หา context ว่าเป็นเล่มไหน / วิชาไหน / ข้อที่เท่าไหร่
     */
    findSlotContextById(conn, slotId) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
      SELECT 
        gs.id          AS slotId,
        gs.booklet_id  AS bookletId,
        gs.subject_id  AS subjectId,
        gs.question_no AS questionNo
      FROM grading_slots gs
      WHERE gs.id = ?
      LIMIT 1
    `;
            const [rows] = yield conn.query(sql, [slotId]);
            if (!rows.length)
                return null;
            return {
                slotId: Number(rows[0].slotId),
                bookletId: Number(rows[0].bookletId),
                subjectId: Number(rows[0].subjectId),
                questionNo: Number(rows[0].questionNo),
            };
        });
    }
    /**
     * ดึงคะแนนทั้งหมดของ "กลุ่มเดียวกัน" = เล่มเดียวกัน + วิชาเดียวกัน + ข้อเดียวกัน
     * ใช้ใน checkAndMarkDisputedIfNeeded เพื่อตรวจว่าคะแนน 2 คนต่างกันเกิน threshold มั้ย
     */
    findScoresForSlotGroup(conn, bookletId, subjectId, questionNo) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
      SELECT
        gs.id         AS id,
        gs.slot_id    AS slotId,
        gs.score      AS score,
        gs.entered_by AS enteredBy,
        gs.entered_at AS enteredAt
      FROM grading_scores gs
      JOIN grading_slots sl
        ON gs.slot_id = sl.id
      WHERE sl.booklet_id = ?
        AND sl.subject_id = ?
        AND sl.question_no = ?
      ORDER BY gs.entered_at ASC
    `;
            const [rows] = yield conn.query(sql, [
                bookletId,
                subjectId,
                questionNo,
            ]);
            return rows;
        });
    }
    /**
     * ลบคะแนนเดิมของ "ข้อเดียวกันในเล่มเดียวกัน" สำหรับผู้ตรวจทุกคน
     * ใช้ตอน reset เพื่อ recheck ใหม่
     */
    deleteScoresForQuestion(conn, bookletId, subjectId, questionNo) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
      DELETE gs
      FROM grading_scores gs
      JOIN grading_slots sl
        ON gs.slot_id = sl.id
      WHERE sl.booklet_id = ?
        AND sl.subject_id = ?
        AND sl.question_no = ?
    `;
            yield conn.query(sql, [bookletId, subjectId, questionNo]);
        });
    }
    /**
     * เซ็ต status ของ slot ทั้งหมดของเล่ม+วิชา+ข้อนี้กลับเป็น 'OPEN'
     */
    resetSlotsStatusForQuestion(conn, bookletId, subjectId, questionNo) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
      UPDATE grading_slots
      SET status = 'OPEN',
          grader_id = grader_id  -- ไม่แตะ grader_id แค่เปลี่ยนสถานะ
      WHERE booklet_id = ?
        AND subject_id = ?
        AND question_no = ?
    `;
            yield conn.query(sql, [bookletId, subjectId, questionNo]);
        });
    }
    findDisputedByBooklet(conn, bookletId) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
      SELECT
        sl.id           AS slotId,
        sl.booklet_id   AS bookletId,
        sl.subject_id   AS subjectId,
        sl.question_no  AS questionNo,
        sl.grader_id    AS graderId,
        sl.grader_order AS graderOrder,
        gs.score        AS score,
        gs.entered_at   AS enteredAt,
        COALESCE(a.full_name, CONCAT('Grader #', g.id)) AS graderName,
        sub.code        AS subjectCode,
        sub.name        AS subjectName
      FROM grading_slots sl
      JOIN grading_scores gs
        ON gs.slot_id = sl.id
      JOIN graders g
        ON sl.grader_id = g.id
      LEFT JOIN accounts a
        ON g.account_id = a.id
      JOIN subjects sub
        ON sl.subject_id = sub.id
      WHERE sl.booklet_id = ?
        AND sl.status = 'DISPUTED'
      ORDER BY sl.subject_id, sl.question_no, sl.grader_order
    `;
            const [rows] = yield conn.query(sql, [bookletId]);
            return rows;
        });
    }
    findDisputedQuestions() {
        return __awaiter(this, arguments, void 0, function* (conn = this.pool, campaign_id, thresholdDiff) {
            // ✅ แก้ไข: JOIN sessions เพื่อเช็ค campaign_id แทน user_sessions
            const sql = `
      SELECT
        t.booklet_id       AS bookletId,
        t.bag_no           AS bagNo,
        t.subject_id       AS subjectId,
        t.subjectCode,
        t.subjectName,
        t.question_no      AS questionNo,
        t.questionLabel,
        t.random_num,

        MIN(t.minScore) AS minScore,
        MAX(t.maxScore) AS maxScore,
        MAX(t.maxScore - t.minScore) AS diff,

        MAX(CASE WHEN t.rnAsc = 1 THEN t.slot_id    END) AS slotId1,
        MAX(CASE WHEN t.rnAsc = 1 THEN t.score      END) AS score1,
        MAX(CASE WHEN t.rnAsc = 1 THEN t.grader_id  END) AS graderId1,
        MAX(CASE WHEN t.rnAsc = 1 THEN t.graderName END) AS graderName1,

        MAX(CASE WHEN t.rnDesc = 1 THEN t.slot_id    END) AS slotId2,
        MAX(CASE WHEN t.rnDesc = 1 THEN t.score      END) AS score2,
        MAX(CASE WHEN t.rnDesc = 1 THEN t.grader_id  END) AS graderId2,
        MAX(CASE WHEN t.rnDesc = 1 THEN t.graderName END) AS graderName2

      FROM (
        SELECT
          sl.booklet_id,
          bg.bag_no,
          sl.subject_id,
          subj.code AS subjectCode,
          subj.name AS subjectName,
          sl.question_no,
          sq.label  AS questionLabel,
          bk.random_num,

          sl.id     AS slot_id,
          gs.score,
          gs.entered_by AS grader_id,
          COALESCE(acc.full_name, CONCAT('Grader #', gr.id)) AS graderName,

          ROW_NUMBER() OVER (
            PARTITION BY sl.booklet_id, sl.subject_id, sl.question_no
            ORDER BY gs.score ASC
          ) AS rnAsc,

          ROW_NUMBER() OVER (
            PARTITION BY sl.booklet_id, sl.subject_id, sl.question_no
            ORDER BY gs.score DESC
          ) AS rnDesc,

          MIN(gs.score) OVER (
            PARTITION BY sl.booklet_id, sl.subject_id, sl.question_no
          ) AS minScore,

          MAX(gs.score) OVER (
            PARTITION BY sl.booklet_id, sl.subject_id, sl.question_no
          ) AS maxScore

        FROM grading_slots sl
        JOIN grading_scores gs
          ON gs.slot_id = sl.id
        JOIN booklets bk
          ON bk.id = sl.booklet_id
        JOIN sessions sess
          ON bk.session_id = sess.id
        LEFT JOIN bags bg
          ON bk.bag_id = bg.id
        JOIN subjects subj
          ON subj.id = sl.subject_id
        LEFT JOIN subject_questions sq
          ON sq.subject_id = sl.subject_id
         AND sq.question_no = sl.question_no
        JOIN graders gr
          ON gs.entered_by = gr.id
        LEFT JOIN accounts acc
          ON gr.account_id = acc.id
        WHERE sess.campaign_id = ?
      ) t
      JOIN (
        SELECT
          sl.booklet_id,
          sl.subject_id,
          sl.question_no,
          COUNT(DISTINCT gs.entered_by) AS gradersCount
        FROM grading_slots sl
        JOIN grading_scores gs
          ON gs.slot_id = sl.id
        GROUP BY
          sl.booklet_id,
          sl.subject_id,
          sl.question_no
      ) gc
        ON gc.booklet_id = t.booklet_id
       AND gc.subject_id = t.subject_id
       AND gc.question_no = t.question_no

      WHERE
        gc.gradersCount >= 2
        AND (t.maxScore - t.minScore) > ?

      GROUP BY
        t.random_num,
        t.booklet_id,
        t.bag_no,
        t.subject_id,
        t.subjectCode,
        t.subjectName,
        t.question_no,
        t.questionLabel

      ORDER BY diff DESC;
    `;
            const [rows] = yield conn.query(sql, [campaign_id, thresholdDiff]);
            return rows;
        });
    }
    findDisputedQuestionsForDashboard(campaign_id, thresholdDiff) {
        return __awaiter(this, void 0, void 0, function* () {
            // ✅ แก้ไข: JOIN sessions เพื่อเช็ค campaign_id แทน user_sessions เหมือนกับด้านบน
            const sql = `
      SELECT
        t.booklet_id       AS bookletId,
        t.bag_no           AS bagNo,
        t.subject_id       AS subjectId,
        t.subjectCode,
        t.subjectName,
        t.question_no      AS questionNo,
        t.questionLabel,

        MIN(t.minScore) AS minScore,
        MAX(t.maxScore) AS maxScore,
        MAX(t.maxScore - t.minScore) AS diff,

        MAX(CASE WHEN t.rnAsc = 1 THEN t.slot_id    END) AS slotId1,
        MAX(CASE WHEN t.rnAsc = 1 THEN t.score      END) AS score1,
        MAX(CASE WHEN t.rnAsc = 1 THEN t.grader_id  END) AS graderId1,
        MAX(CASE WHEN t.rnAsc = 1 THEN t.graderName END) AS graderName1,

        MAX(CASE WHEN t.rnDesc = 1 THEN t.slot_id    END) AS slotId2,
        MAX(CASE WHEN t.rnDesc = 1 THEN t.score      END) AS score2,
        MAX(CASE WHEN t.rnDesc = 1 THEN t.grader_id  END) AS graderId2,
        MAX(CASE WHEN t.rnDesc = 1 THEN t.graderName END) AS graderName2

      FROM (
        SELECT
          sl.booklet_id,
          bg.bag_no,
          sl.subject_id,
          subj.code AS subjectCode,
          subj.name AS subjectName,
          sl.question_no,
          sq.label  AS questionLabel,

          sl.id     AS slot_id,
          gs.score,
          gs.entered_by AS grader_id,
          COALESCE(acc.full_name, CONCAT('Grader #', gr.id)) AS graderName,

          ROW_NUMBER() OVER (
            PARTITION BY sl.booklet_id, sl.subject_id, sl.question_no
            ORDER BY gs.score ASC
          ) AS rnAsc,

          ROW_NUMBER() OVER (
            PARTITION BY sl.booklet_id, sl.subject_id, sl.question_no
            ORDER BY gs.score DESC
          ) AS rnDesc,

          MIN(gs.score) OVER (
            PARTITION BY sl.booklet_id, sl.subject_id, sl.question_no
          ) AS minScore,

          MAX(gs.score) OVER (
            PARTITION BY sl.booklet_id, sl.subject_id, sl.question_no
          ) AS maxScore

        FROM grading_slots sl
        JOIN grading_scores gs
          ON gs.slot_id = sl.id
        JOIN booklets bk
          ON bk.id = sl.booklet_id
        JOIN sessions sess
          ON bk.session_id = sess.id
        LEFT JOIN bags bg
          ON bk.bag_id = bg.id
        JOIN subjects subj
          ON subj.id = sl.subject_id
        LEFT JOIN subject_questions sq
          ON sq.subject_id = sl.subject_id
         AND sq.question_no = sl.question_no
        JOIN graders gr
          ON gs.entered_by = gr.id
        LEFT JOIN accounts acc
          ON gr.account_id = acc.id
        WHERE sess.campaign_id = ?
      ) t
      JOIN (
        SELECT
          sl.booklet_id,
          sl.subject_id,
          sl.question_no,
          COUNT(DISTINCT gs.entered_by) AS gradersCount
        FROM grading_slots sl
        JOIN grading_scores gs
          ON gs.slot_id = sl.id
        GROUP BY
          sl.booklet_id,
          sl.subject_id,
          sl.question_no
      ) gc
        ON gc.booklet_id = t.booklet_id
       AND gc.subject_id = t.subject_id
       AND gc.question_no = t.question_no

      WHERE
        gc.gradersCount >= 2
        AND (t.maxScore - t.minScore) > ?

      GROUP BY
        t.booklet_id,
        t.bag_no,
        t.subject_id,
        t.subjectCode,
        t.subjectName,
        t.question_no,
        t.questionLabel

      ORDER BY diff DESC;
    `;
            const [rows] = yield this.pool.query(sql, [campaign_id, thresholdDiff]);
            return rows ? rows.length : 0;
        });
    }
}
const gradingscoreRepo = new GradingScoreRepo();
exports.default = gradingscoreRepo;
