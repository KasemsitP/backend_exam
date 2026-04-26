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
class GraderBagReportRepo {
    findBagReportHeader(conn, bagId) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
      SELECT
        b.id AS bag_id,
        b.bag_no,
        ec.name AS campaign_name,
        sub.name AS subject_name,
        ec.site AS site,
        MIN(bk.random_num) AS start_num,
        MAX(bk.random_num) AS end_num
      FROM bags b
      JOIN sessions s
        ON s.id = b.session_id
      JOIN exam_campaigns ec
        ON ec.id = s.campaign_id
      JOIN booklets bk
        ON bk.bag_id = b.id
      LEFT JOIN grading_slots gs
        ON gs.booklet_id = bk.id
      LEFT JOIN subjects sub
        ON sub.id = gs.subject_id
      WHERE b.id = ?
      GROUP BY
        b.id,
        b.bag_no,
        ec.name,
        sub.name,
        ec.site
      LIMIT 1
    `;
            const [rows] = yield conn.query(sql, [bagId]);
            return rows[0] || null;
        });
    }
    findGraderInfoByBagId(conn, graderId) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
select a.full_name from accounts a JOIN graders g ON g.account_id = a.id WHERE g.id = ?;
    `;
            const [rows] = yield conn.query(sql, [graderId]);
            return rows[0] || null;
        });
    }
    findConfirmedScoresByBagId(conn, bagId, questionNo, graderId) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
SELECT
  bk.random_num,
  bk.qr_payload,
  gs.question_no,
  gsc.score,
gs.grader_order
FROM bags b
JOIN booklets bk
  ON bk.bag_id = b.id
JOIN grading_slots gs
  ON gs.booklet_id = bk.id
JOIN grading_scores gsc
  ON gsc.slot_id = gs.id
WHERE b.id = ?
  AND gs.question_no = ?
  AND gs.grader_id = ?
ORDER BY CAST(bk.random_num AS UNSIGNED);
    `;
            const [rows] = yield conn.query(sql, [bagId, questionNo, graderId]);
            return rows;
        });
    }
    findBookletsByBagId(conn, bagId) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
            SELECT
                bk.random_num,
                bk.qr_payload
            FROM booklets bk
            WHERE bk.bag_id = ?
            ORDER BY CAST(bk.random_num AS UNSIGNED);
        `;
            const [rows] = yield conn.query(sql, [bagId]);
            return rows;
        });
    }
    findGraderOrderInBag(conn, bagId, graderId, questionNo) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
    SELECT
      gs.grader_order
    FROM grading_slots gs
    JOIN booklets bk
      ON bk.id = gs.booklet_id
    WHERE bk.bag_id = ?
      AND gs.grader_id = ?
      AND gs.question_no = ?
    LIMIT 1
  `;
            const [rows] = yield conn.query(sql, [
                bagId,
                graderId,
                questionNo,
            ]);
            return rows.length ? Number(rows[0].grader_order) : null;
        });
    }
}
const graderBagReportRepo = new GraderBagReportRepo();
exports.default = graderBagReportRepo;
