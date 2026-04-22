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
    // async findDisputedQuestions(
    //   conn: Pool | PoolConnection = this.pool,
    //   campaign_id: number,
    //   thresholdDiff: number
    // ): Promise<DisputedQuestionRow[]> {
    //   // const sql = `
    //   //   -- 🛑 1. กรองหา "เฉพาะข้อที่มีคะแนนขัดแย้งกัน" ก่อน (ทำงานเร็วมาก)
    //   //   WITH DisputedScores AS (
    //   //     SELECT
    //   //       sl.booklet_id,
    //   //       sl.subject_id,
    //   //       sl.question_no,
    //   //       MIN(gs.score) AS minScore,
    //   //       MAX(gs.score) AS maxScore,
    //   //       (MAX(gs.score) - MIN(gs.score)) AS diff
    //   //     FROM grading_slots sl
    //   //     JOIN grading_scores gs ON gs.slot_id = sl.id
    //   //     JOIN booklets bk ON bk.id = sl.booklet_id
    //   //     JOIN sessions sess ON bk.session_id = sess.id
    //   //     WHERE sess.campaign_id = ?
    //   //     GROUP BY sl.booklet_id, sl.subject_id, sl.question_no
    //   //     HAVING COUNT(DISTINCT gs.entered_by) >= 2 
    //   //        AND (MAX(gs.score) - MIN(gs.score)) > ?
    //   //   )
    //   //   -- 🛑 2. เอาเฉพาะข้อที่ขัดแย้ง (ที่มีไม่กี่แถว) มาดึงรายละเอียด และจัดรูปแบบคอลัมน์
    //   //   SELECT
    //   //     d.booklet_id       AS bookletId,
    //   //     bg.bag_no          AS bagNo,
    //   //     d.subject_id       AS subjectId,
    //   //     subj.code          AS subjectCode,
    //   //     subj.name          AS subjectName,
    //   //     d.question_no      AS questionNo,
    //   //     sq.label           AS questionLabel,
    //   //     bk.random_num,
    //   //     d.minScore,
    //   //     d.maxScore,
    //   //     d.diff,
    //   //     -- ดึงข้อมูลคนที่ 1 (ใช้ grader_order เร็วกว่าใช้ ROW_NUMBER มากๆ)
    //   //     MAX(CASE WHEN sl.grader_order = 1 THEN sl.id END) AS slotId1,
    //   //     MAX(CASE WHEN sl.grader_order = 1 THEN gs.score END) AS score1,
    //   //     MAX(CASE WHEN sl.grader_order = 1 THEN gs.entered_by END) AS graderId1,
    //   //     MAX(CASE WHEN sl.grader_order = 1 THEN COALESCE(acc.full_name, CONCAT('Grader #', gr.id)) END) AS graderName1,
    //   //     -- ดึงข้อมูลคนที่ 2
    //   //     MAX(CASE WHEN sl.grader_order = 2 THEN sl.id END) AS slotId2,
    //   //     MAX(CASE WHEN sl.grader_order = 2 THEN gs.score END) AS score2,
    //   //     MAX(CASE WHEN sl.grader_order = 2 THEN gs.entered_by END) AS graderId2,
    //   //     MAX(CASE WHEN sl.grader_order = 2 THEN COALESCE(acc.full_name, CONCAT('Grader #', gr.id)) END) AS graderName2
    //   //   FROM DisputedScores d
    //   //   JOIN booklets bk ON bk.id = d.booklet_id
    //   //   LEFT JOIN bags bg ON bk.bag_id = bg.id
    //   //   JOIN subjects subj ON subj.id = d.subject_id
    //   //   LEFT JOIN subject_questions sq ON sq.subject_id = d.subject_id AND sq.question_no = d.question_no
    //   //   -- JOIN กลับไปหาผู้ตรวจเฉพาะรายการที่ขัดแย้งเท่านั้น
    //   //   JOIN grading_slots sl ON sl.booklet_id = d.booklet_id AND sl.subject_id = d.subject_id AND sl.question_no = d.question_no
    //   //   JOIN grading_scores gs ON gs.slot_id = sl.id
    //   //   JOIN graders gr ON gs.entered_by = gr.id
    //   //   LEFT JOIN accounts acc ON gr.account_id = acc.id
    //   //   GROUP BY
    //   //     d.booklet_id, bg.bag_no, d.subject_id, subj.code, subj.name,
    //   //     d.question_no, sq.label, bk.random_num, d.minScore, d.maxScore, d.diff
    //   //   ORDER BY d.diff DESC;
    //   // `;
    //   const sql = `
    //     SELECT
    //       bk.id              AS bookletId,
    //       bg.bag_no          AS bagNo,
    //       sl1.subject_id     AS subjectId,
    //       subj.code          AS subjectCode,
    //       subj.name          AS subjectName,
    //       sl1.question_no    AS questionNo,
    //       sq.label           AS questionLabel,
    //       bk.random_num,
    //       --  ใช้ LEAST / GREATEST หาค่า Min/Max ในแถวเดียวกันได้เลย
    //       LEAST(gs1.score, gs2.score) AS minScore,
    //       GREATEST(gs1.score, gs2.score) AS maxScore,
    //       ABS(gs1.score - gs2.score) AS diff,
    //       -- ข้อมูลคนที่ 1
    //       sl1.id AS slotId1,
    //       gs1.score AS score1,
    //       gs1.entered_by AS graderId1,
    //       COALESCE(acc1.full_name, CONCAT('Grader #', gr1.id)) AS graderName1,
    //       -- ข้อมูลคนที่ 2
    //       sl2.id AS slotId2,
    //       gs2.score AS score2,
    //       gs2.entered_by AS graderId2,
    //       COALESCE(acc2.full_name, CONCAT('Grader #', gr2.id)) AS graderName2
    //     FROM grading_slots sl1
    //     JOIN grading_scores gs1 ON gs1.slot_id = sl1.id
    //     --  ท่าไม้ตาย: JOIN ตารางตัวเอง เพื่อดึงคะแนนของคนที่ 2 มาแปะข้างๆ คนที่ 1
    //     JOIN grading_slots sl2 
    //       ON sl2.booklet_id = sl1.booklet_id
    //      AND sl2.subject_id = sl1.subject_id
    //      AND sl2.question_no = sl1.question_no
    //      AND sl2.grader_order = 2
    //     JOIN grading_scores gs2 ON gs2.slot_id = sl2.id
    //     -- JOIN ข้อมูลข้อสอบและรอบสอบ
    //     JOIN booklets bk ON bk.id = sl1.booklet_id
    //     JOIN sessions sess ON bk.session_id = sess.id
    //     LEFT JOIN bags bg ON bk.bag_id = bg.id
    //     -- JOIN ข้อมูลวิชา
    //     JOIN subjects subj ON subj.id = sl1.subject_id
    //     LEFT JOIN subject_questions sq 
    //       ON sq.subject_id = sl1.subject_id 
    //      AND sq.question_no = sl1.question_no
    //     -- JOIN หาชื่อผู้ตรวจคนที่ 1
    //     JOIN graders gr1 ON gs1.entered_by = gr1.id
    //     LEFT JOIN accounts acc1 ON gr1.account_id = acc1.id
    //     -- JOIN หาชื่อผู้ตรวจคนที่ 2
    //     JOIN graders gr2 ON gs2.entered_by = gr2.id
    //     LEFT JOIN accounts acc2 ON gr2.account_id = acc2.id
    //     WHERE 
    //       sl1.grader_order = 1       -- ตั้งต้นที่ผู้ตรวจคนที่ 1 เสมอ
    //       AND sess.campaign_id = ?   -- กรองตามรอบสอบ
    //       AND ABS(gs1.score - gs2.score) > ? --  เช็คความขัดแย้งตรงนี้ได้เลย!
    //     ORDER BY diff DESC;
    //   `;
    //   const [rows] = await conn.query<DisputedQuestionRow[]>(sql, [campaign_id, thresholdDiff]);
    //   return rows;
    // }
    findDisputedQuestions() {
        return __awaiter(this, arguments, void 0, function* (conn = this.pool, campaign_id, thresholdDiff) {
            const sql = `
      --  1. หากลุ่มเล่มข้อสอบของ Campaign นี้ก่อน (ลด Scope ข้อมูล)
      WITH TargetBooklets AS (
        SELECT b.id AS booklet_id, b.bag_id, b.random_num , b.qr_payload
        FROM sessions s
        JOIN booklets b ON b.session_id = s.id
        WHERE s.campaign_id = ?
      ),
      --  2. หาเฉพาะ "ข้อที่มีปัญหา" ล้วนๆ (คำนวณแต่ตัวเลข เร็วที่สุด)
      ConflictingScores AS (
        SELECT 
            sl1.booklet_id, sl1.subject_id, sl1.question_no,
            sl1.id AS slotId1, gs1.score AS score1, gs1.entered_by AS graderId1,
            sl2.id AS slotId2, gs2.score AS score2, gs2.entered_by AS graderId2,
            ABS(gs1.score - gs2.score) AS diff,
            LEAST(gs1.score, gs2.score) AS minScore,
            GREATEST(gs1.score, gs2.score) AS maxScore
        FROM TargetBooklets tb
        JOIN grading_slots sl1 ON sl1.booklet_id = tb.booklet_id AND sl1.grader_order = 1
        JOIN grading_scores gs1 ON gs1.slot_id = sl1.id
        JOIN grading_slots sl2 ON sl2.booklet_id = tb.booklet_id 
             AND sl2.subject_id = sl1.subject_id 
             AND sl2.question_no = sl1.question_no 
             AND sl2.grader_order = 2
        JOIN grading_scores gs2 ON gs2.slot_id = sl2.id
        WHERE ABS(gs1.score - gs2.score) > ?
      )
      --  3. เอาข้อที่มีปัญหา (ซึ่งมีน้อยมาก) มาแปะชื่อวิชา และชื่อคนตรวจ
      SELECT 
        cs.booklet_id AS bookletId,
        bg.bag_no AS bagNo,
        cs.subject_id AS subjectId,
        subj.code AS subjectCode,
        subj.name AS subjectName,
        cs.question_no AS questionNo,
        sq.label AS questionLabel,
        tb.random_num,
        tb.qr_payload,
        cs.minScore, cs.maxScore, cs.diff,
        
        cs.slotId1, cs.score1, cs.graderId1,
        COALESCE(acc1.full_name, CONCAT('Grader #', gr1.id)) AS graderName1,
        
        cs.slotId2, cs.score2, cs.graderId2,
        COALESCE(acc2.full_name, CONCAT('Grader #', gr2.id)) AS graderName2
        
      FROM ConflictingScores cs
      JOIN TargetBooklets tb ON tb.booklet_id = cs.booklet_id
      LEFT JOIN bags bg ON bg.id = tb.bag_id
      JOIN subjects subj ON subj.id = cs.subject_id
      LEFT JOIN subject_questions sq ON sq.subject_id = cs.subject_id AND sq.question_no = cs.question_no
      
      -- JOIN ดึงชื่อเฉพาะคนที่มีปัญหาจริงๆ
      JOIN graders gr1 ON gr1.id = cs.graderId1
      LEFT JOIN accounts acc1 ON acc1.id = gr1.account_id
      JOIN graders gr2 ON gr2.id = cs.graderId2
      LEFT JOIN accounts acc2 ON acc2.id = gr2.account_id
      
      ORDER BY cs.diff DESC;
    `;
            const [rows] = yield conn.query(sql, [campaign_id, thresholdDiff]);
            return rows;
        });
    }
    // async findDisputedQuestionsForDashboard(
    //   campaign_id: number,
    //   thresholdDiff: number
    // ): Promise<number> {
    //   // ✅ แก้ไข: JOIN sessions เพื่อเช็ค campaign_id แทน user_sessions เหมือนกับด้านบน
    //   const sql = `
    //     SELECT
    //       t.booklet_id       AS bookletId,
    //       t.bag_no           AS bagNo,
    //       t.subject_id       AS subjectId,
    //       t.subjectCode,
    //       t.subjectName,
    //       t.question_no      AS questionNo,
    //       t.questionLabel,
    //       MIN(t.minScore) AS minScore,
    //       MAX(t.maxScore) AS maxScore,
    //       MAX(t.maxScore - t.minScore) AS diff,
    //       MAX(CASE WHEN t.rnAsc = 1 THEN t.slot_id    END) AS slotId1,
    //       MAX(CASE WHEN t.rnAsc = 1 THEN t.score      END) AS score1,
    //       MAX(CASE WHEN t.rnAsc = 1 THEN t.grader_id  END) AS graderId1,
    //       MAX(CASE WHEN t.rnAsc = 1 THEN t.graderName END) AS graderName1,
    //       MAX(CASE WHEN t.rnDesc = 1 THEN t.slot_id    END) AS slotId2,
    //       MAX(CASE WHEN t.rnDesc = 1 THEN t.score      END) AS score2,
    //       MAX(CASE WHEN t.rnDesc = 1 THEN t.grader_id  END) AS graderId2,
    //       MAX(CASE WHEN t.rnDesc = 1 THEN t.graderName END) AS graderName2
    //     FROM (
    //       SELECT
    //         sl.booklet_id,
    //         bg.bag_no,
    //         sl.subject_id,
    //         subj.code AS subjectCode,
    //         subj.name AS subjectName,
    //         sl.question_no,
    //         sq.label  AS questionLabel,
    //         sl.id     AS slot_id,
    //         gs.score,
    //         gs.entered_by AS grader_id,
    //         COALESCE(acc.full_name, CONCAT('Grader #', gr.id)) AS graderName,
    //         ROW_NUMBER() OVER (
    //           PARTITION BY sl.booklet_id, sl.subject_id, sl.question_no
    //           ORDER BY gs.score ASC
    //         ) AS rnAsc,
    //         ROW_NUMBER() OVER (
    //           PARTITION BY sl.booklet_id, sl.subject_id, sl.question_no
    //           ORDER BY gs.score DESC
    //         ) AS rnDesc,
    //         MIN(gs.score) OVER (
    //           PARTITION BY sl.booklet_id, sl.subject_id, sl.question_no
    //         ) AS minScore,
    //         MAX(gs.score) OVER (
    //           PARTITION BY sl.booklet_id, sl.subject_id, sl.question_no
    //         ) AS maxScore
    //       FROM grading_slots sl
    //       JOIN grading_scores gs
    //         ON gs.slot_id = sl.id
    //       JOIN booklets bk
    //         ON bk.id = sl.booklet_id
    //       JOIN sessions sess
    //         ON bk.session_id = sess.id
    //       LEFT JOIN bags bg
    //         ON bk.bag_id = bg.id
    //       JOIN subjects subj
    //         ON subj.id = sl.subject_id
    //       LEFT JOIN subject_questions sq
    //         ON sq.subject_id = sl.subject_id
    //        AND sq.question_no = sl.question_no
    //       JOIN graders gr
    //         ON gs.entered_by = gr.id
    //       LEFT JOIN accounts acc
    //         ON gr.account_id = acc.id
    //       WHERE sess.campaign_id = ?
    //     ) t
    //     JOIN (
    //       SELECT
    //         sl.booklet_id,
    //         sl.subject_id,
    //         sl.question_no,
    //         COUNT(DISTINCT gs.entered_by) AS gradersCount
    //       FROM grading_slots sl
    //       JOIN grading_scores gs
    //         ON gs.slot_id = sl.id
    //       GROUP BY
    //         sl.booklet_id,
    //         sl.subject_id,
    //         sl.question_no
    //     ) gc
    //       ON gc.booklet_id = t.booklet_id
    //      AND gc.subject_id = t.subject_id
    //      AND gc.question_no = t.question_no
    //     WHERE
    //       gc.gradersCount >= 2
    //       AND (t.maxScore - t.minScore) > ?
    //     GROUP BY
    //       t.booklet_id,
    //       t.bag_no,
    //       t.subject_id,
    //       t.subjectCode,
    //       t.subjectName,
    //       t.question_no,
    //       t.questionLabel
    //     ORDER BY diff DESC;
    //   `;
    //   const [rows] = await this.pool.query<DisputedQuestionRow[]>(sql, [campaign_id, thresholdDiff]);
    //   return rows ? rows.length : 0;
    // }
    findDisputedQuestionsForDashboard(campaign_id, thresholdDiff) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            // 🚀 ใช้ท่า Self-Join เพื่อหาคะแนนขัดแย้ง และใช้ COUNT(1) ให้นับจาก Database เลย
            // ตัดการ JOIN ตาราง subjects, subject_questions, bags, graders, accounts ทิ้งให้หมด!
            const sql = `
      SELECT COUNT(1) AS total_disputed
      FROM grading_slots sl1
      JOIN grading_scores gs1 ON gs1.slot_id = sl1.id
      
      -- เอาผู้ตรวจคนที่ 2 มาชนกับคนที่ 1
      JOIN grading_slots sl2 
        ON sl2.booklet_id = sl1.booklet_id
       AND sl2.subject_id = sl1.subject_id
       AND sl2.question_no = sl1.question_no
       AND sl2.grader_order = 2
      JOIN grading_scores gs2 ON gs2.slot_id = sl2.id

      -- เชื่อมไปหา campaign_id
      JOIN booklets bk ON bk.id = sl1.booklet_id
      JOIN sessions sess ON bk.session_id = sess.id
      
      WHERE 
        sl1.grader_order = 1
        AND sess.campaign_id = ?
        AND ABS(gs1.score - gs2.score) > ? ; -- เช็คคะแนนที่ห่างกัน
    `;
            // คืนค่าเป็นตัวเลขออกมาตัวเดียวเลย ไม่ต้องเอา Array มาเปลือง RAM
            const [rows] = yield this.pool.query(sql, [campaign_id, thresholdDiff]);
            return ((_a = rows[0]) === null || _a === void 0 ? void 0 : _a.total_disputed) || 0;
        });
    }
    InsertLogForRecheck(conn, params) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
INSERT INTO grading_score_logs (
  booklet_id,
  subject_id,
  question_no,
  slot_id1,
  slot_id2,
  grader1_id,
  grader2_id,
  old_score1,
  old_score2,
  changed_by,
  changed_at
)
VALUES (
  ?,
  ?,
  ?,
  ?,
  ?,
  ?,
  ?,
  ?,
  ?,
  ?,
  ?
);
    `;
            yield conn.query(sql, [params.bookletId, params.subjectId, params.questionNo, params.slotId1, params.slotId2, params.grader1Id, params.grader2Id, params.oldScore1, params.oldScore2, params.changedBy, new Date()]);
        });
    }
    getMaxScoreforQuestionBySlotId(conn, slotId) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
  SELECT
  gs.id AS slot_id,
  gs.booklet_id,
  gs.subject_id,
  gs.question_no,
  sq.label AS question_label,
  sq.max_score
FROM grading_slots gs
JOIN subject_questions sq
  ON sq.subject_id = gs.subject_id
 AND sq.question_no = gs.question_no
WHERE gs.id = ?;
  `;
            const [rows] = yield conn.query(sql, [slotId]);
            if (rows.length === 0) {
                return null;
            }
            return rows[0];
        });
    }
    ResetScoreEdit(conn, slotId1, slotId2, score1, score2) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql1 = `
UPDATE grading_scores
SET score = CASE
  WHEN slot_id = ? THEN ?
  WHEN slot_id = ? THEN ?
  ELSE score
END
WHERE slot_id IN (?, ?)
`;
            yield conn.query(sql1, [
                slotId1, score1,
                slotId2, score2,
                slotId1, slotId2
            ]);
            const sql2 = `
UPDATE grading_slots
SET status = 'COMPLETED'
WHERE id IN (?, ?)
`;
            yield conn.query(sql2, [slotId1, slotId2]);
        });
    }
    existsScoreBySlotId(conn, slotId) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
    SELECT 1
    FROM grading_scores
    WHERE slot_id = ?
    LIMIT 1
  `;
            const [rows] = yield conn.query(sql, [slotId]);
            return rows.length > 0;
        });
    }
    insertScoresFromDraftsByBagId(conn, bagId) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
    INSERT INTO grading_scores (
      slot_id,
      score,
      entered_by,
      entered_at
    )
    SELECT
      gsd.slot_id,
      gsd.score,
      gsd.grader_id,
      NOW()
    FROM grading_score_drafts gsd
    WHERE gsd.bag_id = ?
      AND gsd.status = 'DRAFT'
  `;
            yield conn.query(sql, [bagId]);
        });
    }
    insertScoresFromDraftsByBagIdAndGraderId(conn, bagId, graderId) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
    INSERT INTO grading_scores (
      slot_id,
      score,
      entered_by,
      entered_at
    )
    SELECT
      gsd.slot_id,
      gsd.score,
      gsd.grader_id,
      NOW()
    FROM grading_score_drafts gsd
    WHERE gsd.bag_id = ?
      AND gsd.grader_id = ?
      AND gsd.status = 'DRAFT'
  `;
            yield conn.query(sql, [bagId, graderId]);
        });
    }
    existsScoreBySlotGroupAndGrader(conn, bookletId, subjectId, questionNo, graderId) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
    SELECT 1
    FROM grading_scores gs
    JOIN grading_slots s ON s.id = gs.slot_id
    WHERE s.booklet_id = ?
      AND s.subject_id = ?
      AND s.question_no = ?
      AND s.grader_id = ?
    LIMIT 1
  `;
            const [rows] = yield conn.query(sql, [
                bookletId,
                subjectId,
                questionNo,
                graderId,
            ]);
            return rows.length > 0;
        });
    }
}
const gradingscoreRepo = new GradingScoreRepo();
exports.default = gradingscoreRepo;
