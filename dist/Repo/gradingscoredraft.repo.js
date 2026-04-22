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
class GradingScoreDraftRepo {
    constructor() {
        // @ts-ignore
        this.pool = DB_1.DB.getInstance();
    }
    verifySlotContext(conn, params) {
        return __awaiter(this, void 0, void 0, function* () {
            const { slotId, campaignId, graderId } = params;
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
      LIMIT 1
    `;
            const [rows] = yield conn.execute(sql, [
                slotId,
                campaignId,
                graderId,
            ]);
            return rows.length > 0;
        });
    }
    findDraftContextBySlotId(conn, slotId) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
      SELECT
        gs.id AS slotId,
        gs.booklet_id AS bookletId,
        gs.subject_id AS subjectId,
        gs.question_no AS questionNo,
        gs.grader_id AS graderId,
        b.bag_id AS bagId
      FROM grading_slots gs
      JOIN booklets b
        ON b.id = gs.booklet_id
      WHERE gs.id = ?
      LIMIT 1
    `;
            const [rows] = yield conn.query(sql, [slotId]);
            return rows[0] || null;
        });
    }
    checkScoreInfo(conn, params) {
        return __awaiter(this, void 0, void 0, function* () {
            const { slotId, graderId, questionNo } = params;
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
      WHERE gs.id = ?
        AND gs.grader_id = ?
        AND gs.question_no = ?
      LIMIT 1
    `;
            const [rows] = yield conn.query(sql, [
                slotId,
                graderId,
                questionNo,
            ]);
            return rows[0] || null;
        });
    }
    findDraftBySlotId(conn, slotId) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
      SELECT
        id,
        bag_id,
        booklet_id,
        subject_id,
        question_no,
        slot_id,
        grader_id,
        score,
        status,
        created_at,
        updated_at
      FROM grading_score_drafts
      WHERE slot_id = ?
      LIMIT 1
    `;
            const [rows] = yield conn.query(sql, [slotId]);
            return rows[0] || null;
        });
    }
    insertDraft(conn, params) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
      INSERT INTO grading_score_drafts (
        bag_id,
        booklet_id,
        subject_id,
        question_no,
        slot_id,
        grader_id,
        score,
        status,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'DRAFT', NOW(), NOW())
    `;
            const [result] = yield conn.execute(sql, [
                params.bagId,
                params.bookletId,
                params.subjectId,
                params.questionNo,
                params.slotId,
                params.graderId,
                params.score,
            ]);
            return result.insertId;
        });
    }
    updateDraftScoreBySlotId(conn, slotId, score) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
      UPDATE grading_score_drafts
      SET
        score = ?,
        status = 'DRAFT',
        updated_at = NOW()
      WHERE slot_id = ?
    `;
            yield conn.execute(sql, [score, slotId]);
        });
    }
    upsertDraft(conn, params) {
        return __awaiter(this, void 0, void 0, function* () {
            const existing = yield this.findDraftBySlotId(conn, params.slotId);
            if (!existing) {
                yield this.insertDraft(conn, params);
                return;
            }
            yield this.updateDraftScoreBySlotId(conn, params.slotId, params.score);
        });
    }
    findDraftsByBagId(conn_1, bagId_1) {
        return __awaiter(this, arguments, void 0, function* (conn, bagId, status = "DRAFT") {
            const sql = `
      SELECT
        gs.id,
        gs.bag_id,
        gs.booklet_id,
        gs.subject_id,
        gs.question_no,
        gs.slot_id,
        gs.grader_id,
        gs.score,
        gs.status,
        gs.created_at,
        gs.updated_at,
        b.bag_no
      FROM grading_score_drafts gs
      JOIN bags b ON b.id = gs.bag_id
      WHERE gs.bag_id = ?
        AND gs.status = ?
      ORDER BY gs.booklet_id, gs.subject_id, gs.question_no, gs.slot_id
    `;
            const [rows] = yield conn.query(sql, [
                bagId,
                status,
            ]);
            return rows;
        });
    }
    countDraftsByBagId(conn_1, bagId_1) {
        return __awaiter(this, arguments, void 0, function* (conn, bagId, status = "DRAFT") {
            var _a, _b;
            const sql = `
      SELECT COUNT(*) AS total
      FROM grading_score_drafts
      WHERE bag_id = ?
        AND status = ?
    `;
            const [rows] = yield conn.query(sql, [bagId, status]);
            return Number((_b = (_a = rows[0]) === null || _a === void 0 ? void 0 : _a.total) !== null && _b !== void 0 ? _b : 0);
        });
    }
    cancelDraftBySlotId(conn, slotId) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
      UPDATE grading_score_drafts
      SET
        status = 'CANCELLED',
        updated_at = NOW()
      WHERE slot_id = ?
        AND status = 'DRAFT'
    `;
            yield conn.execute(sql, [slotId]);
        });
    }
    markDraftsConfirmedByBagId(conn, bagId) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
      UPDATE grading_score_drafts
      SET
        status = 'CONFIRMED',
        updated_at = NOW()
      WHERE bag_id = ?
        AND status = 'DRAFT'
    `;
            yield conn.execute(sql, [bagId]);
        });
    }
    getDraftQuestionInfoBySlotId(conn, slotId) {
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
      WHERE gs.id = ?
      LIMIT 1
    `;
            const [rows] = yield conn.query(sql, [slotId]);
            return rows[0] || null;
        });
    }
    findUnscoredSlotForGrader(conn, bookletId, subjectId, questionNo, graderId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const sql = `
SELECT s.*
FROM grading_slots s
LEFT JOIN grading_score_drafts gs
  ON gs.slot_id = s.id
WHERE s.booklet_id = ?
  AND s.subject_id = ?
  AND s.question_no = ?
  AND s.grader_id  = ?
  AND gs.id IS NULL
LIMIT 1
FOR UPDATE;
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
    findActiveBagByGraderId(conn, graderId) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
    SELECT
      b.id AS bag_id,
      b.bag_no
    FROM bags b
    WHERE b.id = (
      SELECT x.bag_id
      FROM (
        SELECT gsd.bag_id
        FROM grading_score_drafts gsd
        WHERE gsd.grader_id = ?
          AND gsd.status = 'DRAFT'
        GROUP BY gsd.bag_id
        ORDER BY MAX(gsd.updated_at) DESC
        LIMIT 1
      ) x
    )
    LIMIT 1
  `;
            const [rows] = yield conn.query(sql, [graderId]);
            if (!rows.length)
                return null;
            return {
                bag_id: Number(rows[0].bag_id),
                bag_no: Number(rows[0].bag_no),
            };
        });
    }
    getAllDraftsUnConfirmed(conn_1, graderId_1) {
        return __awaiter(this, arguments, void 0, function* (conn, graderId, status = "DRAFT") {
            const sql = `
SELECT
  b.id AS bag_id,
  b.bag_no,

  bk.id AS booklet_id,
  bk.random_num,
  bk.qr_payload AS payload,

  gs.id AS slot_id,
  gs.subject_id,
  gs.question_no,
  gs.grader_id,
  gs.grader_order,
  gs.status AS slot_status,

  gsd.id AS draft_id,
  gsd.score,
  gsd.status AS draft_status,
  gsd.created_at,
  gsd.updated_at,

  CASE
    WHEN gs.id IS NULL THEN 'ยังไม่มี slot'
    WHEN gsd.id IS NULL THEN 'มี slot แต่ยังไม่ตรวจ'
    ELSE 'ตรวจแล้ว'
  END AS progress_status

FROM bags b
JOIN booklets bk
  ON bk.bag_id = b.id

LEFT JOIN grading_slots gs
  ON gs.booklet_id = bk.id
 AND gs.grader_id = ?

LEFT JOIN grading_score_drafts gsd
  ON gsd.slot_id = gs.id
 AND gsd.status = 'DRAFT'

WHERE b.id = (
  SELECT x.bag_id
  FROM (
    SELECT gsd2.bag_id
    FROM grading_score_drafts gsd2
    WHERE gsd2.grader_id = ?
      AND gsd2.status = 'DRAFT'
    GROUP BY gsd2.bag_id
    ORDER BY MAX(gsd2.updated_at) DESC
    LIMIT 1
  ) x
)

ORDER BY bk.random_num, gs.subject_id, gs.question_no, gs.id;
    `;
            const [rows] = yield conn.query(sql, [
                graderId, graderId
            ]);
            return rows;
        });
    }
    validateSlotsForConfirm(conn, bagId, graderId, slotIds) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            if (!slotIds.length)
                return false;
            const placeholders = slotIds.map(() => "?").join(",");
            const sql = `
    SELECT COUNT(*) AS total
    FROM grading_slots gs
    JOIN booklets bk
      ON bk.id = gs.booklet_id
    WHERE gs.id IN (${placeholders})
      AND gs.grader_id = ?
      AND bk.bag_id = ?
  `;
            const [rows] = yield conn.query(sql, [
                ...slotIds,
                graderId,
                bagId,
            ]);
            return Number((_b = (_a = rows[0]) === null || _a === void 0 ? void 0 : _a.total) !== null && _b !== void 0 ? _b : 0) === slotIds.length;
        });
    }
    markDraftsConfirmedByBagIdAndGraderId(conn, bagId, graderId) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
    UPDATE grading_score_drafts
    SET
      status = 'CONFIRMED',
      updated_at = NOW()
    WHERE bag_id = ?
      AND grader_id = ?
      AND status = 'DRAFT'
  `;
            yield conn.query(sql, [bagId, graderId]);
        });
    }
    getAllDraftsUnConfirmedByBagId(conn, bagId, graderId) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
    SELECT
      b.id AS bag_id,
      b.bag_no,

      bk.id AS booklet_id,
      bk.random_num,
      bk.qr_payload AS payload,

      gs.id AS slot_id,
      gs.subject_id,
      gs.question_no,
      gs.grader_id,
      gs.grader_order,
      gs.status AS slot_status,

      gsd.id AS draft_id,
      gsd.score,
      gsd.status AS draft_status,
      gsd.created_at,
      gsd.updated_at,

      CASE
        WHEN gs.id IS NULL THEN 'ยังไม่มี slot'
        WHEN gsd.id IS NULL THEN 'มี slot แต่ยังไม่ตรวจ'
        ELSE 'ตรวจแล้ว'
      END AS progress_status

    FROM bags b
    JOIN booklets bk
      ON bk.bag_id = b.id

    LEFT JOIN grading_slots gs
      ON gs.booklet_id = bk.id
     AND gs.grader_id = ?

    LEFT JOIN grading_score_drafts gsd
      ON gsd.slot_id = gs.id
     AND gsd.status = 'DRAFT'

    WHERE b.id = ?

    ORDER BY bk.random_num, gs.subject_id, gs.question_no, gs.id
  `;
            const [rows] = yield conn.query(sql, [
                graderId,
                bagId,
            ]);
            return rows;
        });
    }
    getActiveDraftsByLock(conn, graderId) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
SELECT
  b.id AS bag_id,
  b.bag_no,

  bk.id AS booklet_id,
  bk.random_num,
  bk.qr_payload AS payload,


  gs.id AS slot_id,
  gs.subject_id,
  s.name AS subject_name,         

  gs.question_no,
  sq.label AS question_label,      

  gs.grader_id,
  gs.grader_order,
  gs.status AS slot_status,

  gsd.id AS draft_id,
  gsd.score,
  gsd.status AS draft_status,
  gsd.created_at,
  gsd.updated_at,

  CASE
    WHEN gs.id IS NULL THEN 'ยังไม่มี slot'
    WHEN gsd.id IS NULL THEN 'มี slot แต่ยังไม่ตรวจ'
    ELSE 'ตรวจแล้ว'
  END AS progress_status

FROM grader_work_locks gwl

JOIN bags b
  ON b.id = gwl.bag_id

JOIN booklets bk
  ON bk.bag_id = b.id

LEFT JOIN grading_slots gs
  ON gs.booklet_id = bk.id
 AND gs.grader_id = gwl.grader_id
 AND gs.question_no = gwl.question_no

--  JOIN วิชา
LEFT JOIN subjects s
  ON s.id = gs.subject_id

--  JOIN หัวข้อข้อสอบ
LEFT JOIN subject_questions sq
  ON sq.subject_id = gs.subject_id
 AND sq.question_no = gs.question_no

LEFT JOIN grading_score_drafts gsd
  ON gsd.slot_id = gs.id
 AND gsd.status = 'DRAFT'

WHERE gwl.grader_id = ?
  AND gwl.status = 'ACTIVE'

ORDER BY bk.random_num, gs.question_no;
  `;
            const [rows] = yield conn.query(sql, [graderId]);
            return rows;
        });
    }
    //ใหม่เพื่อสำหรับการสแกนซ้ำ
    findDraftSlotForGrader(conn, bookletId, subjectId, questionNo, graderId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const sql = `
    SELECT s.*
    FROM grading_slots s
    JOIN grading_score_drafts d
      ON d.slot_id = s.id
     AND d.status = 'DRAFT'
    WHERE s.booklet_id = ?
      AND s.subject_id = ?
      AND s.question_no = ?
      AND s.grader_id = ?
    LIMIT 1
    FOR UPDATE
  `;
            const [rows] = yield conn.query(sql, [
                bookletId,
                subjectId,
                questionNo,
                graderId,
            ]);
            return (_a = rows[0]) !== null && _a !== void 0 ? _a : null;
        });
    }
}
const gradingscoredraftRepo = new GradingScoreDraftRepo();
exports.default = gradingscoredraftRepo;
