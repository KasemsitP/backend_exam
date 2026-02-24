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
exports.buildRowsByBooklet = buildRowsByBooklet;
exports.findQuestionCountForBagSubject = findQuestionCountForBagSubject;
exports.findQuestionLabelForBagSubject = findQuestionLabelForBagSubject;
exports.findQuestionAveragesForBagSubject = findQuestionAveragesForBagSubject;
exports.findQuestionStatsForBag = findQuestionStatsForBag;
exports.findBookletQuestionStatsForBag = findBookletQuestionStatsForBag;
exports.getUnlockCampaignByBagId = getUnlockCampaignByBagId;
exports.getUnlockCampaignNoconn = getUnlockCampaignNoconn;
exports.getInfomation = getInfomation;
exports.getAllBags = getAllBags;
exports.getCampaignUnlock = getCampaignUnlock;
exports.getGraderBagSummary = getGraderBagSummary;
exports.getGraderInfo = getGraderInfo;
const DB_1 = require("../model/DB");
/**
 * แปลง raw average (ต่อเล่ม-ต่อข้อ) → ตารางตามเล่ม
 */
function buildRowsByBooklet(raw, questionCount) {
    const map = new Map();
    for (const r of raw) {
        let row = map.get(r.booklet_id);
        if (!row) {
            const perQuestion = {};
            for (let q = 1; q <= questionCount; q++) {
                perQuestion[String(q)] = null;
            }
            row = {
                bookletId: r.booklet_id,
                examCode: r.exam_code,
                perQuestion,
                totalScore: 0,
            };
            map.set(r.booklet_id, row);
        }
        const score = Number(r.avg_score);
        row.perQuestion[String(r.question_no)] = score;
        row.totalScore += score;
    }
    return Array.from(map.values()).sort((a, b) => a.bookletId - b.bookletId);
}
/**
 * ดึงจำนวนข้อของวิชาในถุงนั้น
 * ใช้ bags -> sessions -> session_subjects.question_count
 */
// export async function findQuestionCountForBagSubject(
//   conn: PoolConnection,
//   bagId: number,
//   subjectId: number
// ): Promise<number | null> {
//   const sql = `
//     SELECT ss.question_count
//     FROM bags b
//     JOIN sessions s
//       ON b.session_id = s.id
//     JOIN session_subjects ss
//       ON ss.session_id = s.id
//     WHERE b.id = ?
//     LIMIT 1;
//   `;
//   const [rows] = await conn.query<RowDataPacket[]>(sql, [bagId]);
//   if (!rows.length) return null;
//   const qc = rows[0].question_count as number | null;
//   return qc ?? null;
// }
function findQuestionCountForBagSubject(conn, bagId, subjectId) {
    return __awaiter(this, void 0, void 0, function* () {
        const subjectCond = subjectId ? " AND ss.subject_id = ? " : "";
        const sql = `
    SELECT
      COUNT(*) AS question_count
    FROM bags b
    JOIN sessions s
      ON b.session_id = s.id
    JOIN session_subjects ss
      ON ss.session_id = s.id
    JOIN subject_questions sq
      ON sq.subject_id = ss.subject_id
    WHERE b.id = ?
    ${subjectCond}
  `;
        const params = [bagId];
        if (subjectId)
            params.push(subjectId);
        const [rows] = yield conn.query(sql, params);
        if (!rows.length)
            return null;
        const qc = rows[0].question_count;
        return qc !== null && qc !== void 0 ? qc : null;
    });
}
function findQuestionLabelForBagSubject(conn, bagId, subjectId) {
    return __awaiter(this, void 0, void 0, function* () {
        const subjectCond = subjectId ? " AND ss.subject_id = ? " : "";
        const sql = `
    SELECT
      sq.question_no,
      sq.label
    FROM bags b
    JOIN sessions s
      ON b.session_id = s.id
    JOIN session_subjects ss
      ON ss.session_id = s.id
    JOIN subject_questions sq
      ON sq.subject_id = ss.subject_id
    WHERE b.id = ?
    ${subjectCond}
    ORDER BY sq.question_no ASC
  `;
        const params = [bagId];
        if (subjectId)
            params.push(subjectId);
        const [rows] = yield conn.query(sql, params);
        if (!rows.length)
            return null;
        return rows;
    });
}
//      AND ss.subject_id = ?
/**
 * ดึงคะแนนเฉลี่ยรายข้อ (หลังจากรวม 2 ผู้ตรวจแล้ว) แบบ row ธรรมดา
 */
function findQuestionAveragesForBagSubject(conn, bagId, subjectId) {
    return __awaiter(this, void 0, void 0, function* () {
        const sql = `
SELECT
  b.id          AS booklet_id,
  u.user_code   AS exam_code,
  s.question_no,             -- ✅ เอาจาก grading_slots
  AVG(gs_q.score) AS avg_score
FROM booklets b
JOIN bags bg
  ON b.bag_id = bg.id
JOIN user_sessions us
  ON b.user_session_id = us.id
JOIN user_campaigns uc
  ON us.user_campaign_id = uc.id
JOIN users u
  ON uc.user_id = u.id
JOIN grading_slots s
  ON s.booklet_id = b.id
JOIN grading_scores gs_q
  ON gs_q.slot_id = s.id
WHERE bg.id = ?            
GROUP BY
  b.id,
  u.user_code,
  s.question_no
ORDER BY
  b.id,
  s.question_no;

  `;
        const [rows] = yield conn.query(sql, [
            bagId,
        ]);
        return rows;
    });
}
/**
 * ดึงสรุป "ตามข้อ" ของถุงหนึ่ง:
 *  - คะแนนเฉลี่ยผู้ตรวจลำดับ 1
 *  - คะแนนเฉลี่ยผู้ตรวจลำดับ 2
 *  - คะแนนเฉลี่ยรวม (ทุกผู้ตรวจ)
 *  - รายชื่อผู้ตรวจแต่ละลำดับ (ถ้ามีหลายคนจะ join ด้วย ", ")
 *
 * หมายเหตุ: ตอนนี้ไม่ใช้ subjectId เพราะ 1 session มี 1 subject ตามที่คุณบอก
 */
function findQuestionStatsForBag(conn, bagId, subjectId // ไม่ได้ใช้ แต่วางไว้ให้ signature เหมือน service เดิม
) {
    return __awaiter(this, void 0, void 0, function* () {
        const sql = `
    SELECT
      s.question_no,
      sq.label,
      sq.note AS category,

      -- ค่าเฉลี่ยคะแนนผู้ตรวจลำดับ 1
      AVG(CASE WHEN s.grader_order = 1 THEN gs.score END) AS grader1_score,

      -- ค่าเฉลี่ยคะแนนผู้ตรวจลำดับ 2
      AVG(CASE WHEN s.grader_order = 2 THEN gs.score END) AS grader2_score,

      -- ค่าเฉลี่ยรวมทุกผู้ตรวจ
      AVG(gs.score) AS final_score,

      -- รายชื่อผู้ตรวจลำดับ 1 ที่เคยให้คะแนนข้อนี้ในถุงนี้
      GROUP_CONCAT(
        DISTINCT CASE WHEN s.grader_order = 1 THEN a.full_name END
        ORDER BY a.full_name
        SEPARATOR ', '
      ) AS grader1_names,

      -- รายชื่อผู้ตรวจลำดับ 2
      GROUP_CONCAT(
        DISTINCT CASE WHEN s.grader_order = 2 THEN a.full_name END
        ORDER BY a.full_name
        SEPARATOR ', '
      ) AS grader2_names

    FROM booklets b
    JOIN bags bg
      ON b.bag_id = bg.id
    JOIN grading_slots s
      ON s.booklet_id = b.id
    JOIN grading_scores gs
      ON gs.slot_id = s.id

    -- label / category มาจาก subject_questions
    LEFT JOIN subject_questions sq
      ON sq.subject_id = s.subject_id
     AND sq.question_no = s.question_no

    -- ใครเป็นคนให้คะแนนจริง → graders → accounts เพื่อดึงชื่อ
    LEFT JOIN graders g
      ON g.id = gs.entered_by
    LEFT JOIN accounts a
      ON a.id = g.account_id

    WHERE bg.id = ?

    GROUP BY
      s.question_no,
      sq.label,
      sq.note

    ORDER BY
      s.question_no;
  `;
        const [rows] = yield conn.query(sql, [bagId]);
        return rows;
    });
}
function findBookletQuestionStatsForBag(conn, bagId, subjectId // ยังไม่ใช้ เพราะ 1 session = 1 subject ตามที่คุณบอก
) {
    return __awaiter(this, void 0, void 0, function* () {
        const sql = `
    SELECT
      b.id        AS booklet_id,
      u.user_code AS exam_code,
      s.question_no,
      sq.label,
      sq.note AS category,
      b.random_num,

      -- ค่าเฉลี่ยคะแนนของผู้ตรวจลำดับ 1 "เฉพาะเล่มนี้ + ข้อนี้"
      AVG(CASE WHEN s.grader_order = 1 THEN gs.score END) AS grader1_score,

      -- ค่าเฉลี่ยคะแนนของผู้ตรวจลำดับ 2 "เฉพาะเล่มนี้ + ข้อนี้"
      AVG(CASE WHEN s.grader_order = 2 THEN gs.score END) AS grader2_score,

      -- ค่าเฉลี่ยรวมทุกผู้ตรวจของ "เล่มนี้ + ข้อนี้" (ใช้เป็น finalScore)
      AVG(gs.score) AS final_score,

      -- รายชื่อผู้ตรวจลำดับ 1 ของเล่มนี้ + ข้อนี้
      GROUP_CONCAT(
        DISTINCT CASE WHEN s.grader_order = 1 THEN a.full_name END
        ORDER BY a.full_name
        SEPARATOR ', '
      ) AS grader1_names,

      -- รายชื่อผู้ตรวจลำดับ 2 ของเล่มนี้ + ข้อนี้
      GROUP_CONCAT(
        DISTINCT CASE WHEN s.grader_order = 2 THEN a.full_name END
        ORDER BY a.full_name
        SEPARATOR ', '
      ) AS grader2_names

FROM bags bg
LEFT JOIN booklets b
  ON b.bag_id = bg.id

LEFT JOIN user_sessions us
  ON b.user_session_id = us.id
LEFT JOIN user_campaigns uc
  ON us.user_campaign_id = uc.id
LEFT JOIN users u
  ON uc.user_id = u.id

LEFT JOIN grading_slots s
  ON s.booklet_id = b.id
LEFT JOIN grading_scores gs
  ON gs.slot_id = s.id

LEFT JOIN subject_questions sq
  ON sq.subject_id = s.subject_id
 AND sq.question_no = s.question_no

LEFT JOIN graders g
  ON g.id = gs.entered_by
LEFT JOIN accounts a
  ON a.id = g.account_id
    WHERE bg.id = ?

    GROUP BY
      b.id,
      u.user_code,
      s.question_no,
      sq.label,
      sq.note

    ORDER BY
      b.id,
      s.question_no;
  `;
        const [rows] = yield conn.query(sql, [bagId]);
        return rows;
    });
}
function getUnlockCampaignByBagId(conn, bagId) {
    return __awaiter(this, void 0, void 0, function* () {
        const sql = `SELECT s.campaign_id , ec.is_unlock from bags b JOIN sessions s ON s.id = b.session_id join exam_campaigns ec ON ec.id = s.campaign_id WHERE b.id = ?;`;
        const [rows] = yield conn.query(sql, [bagId]);
        return rows;
    });
}
function getUnlockCampaignNoconn(bagId) {
    return __awaiter(this, void 0, void 0, function* () {
        const pool = DB_1.DB.getInstance();
        const sql = `SELECT s.campaign_id , ec.is_unlock from bags b JOIN sessions s ON s.id = b.session_id join exam_campaigns ec ON ec.id = s.campaign_id WHERE b.id = ?;`;
        const [rows] = yield pool.query(sql, [bagId]);
        return rows;
    });
}
function getInfomation(bagId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const pool = DB_1.DB.getInstance();
        const sql = `
    SELECT
      s.campaign_id,
      ec.name,
      ec.campaign_size,
      ec.year_be,
      b.bag_no,
      ec.site,
      sub.name AS subject_name
    FROM bags b
    JOIN sessions s ON b.session_id = s.id
    JOIN exam_campaigns ec ON ec.id = s.campaign_id
    JOIN session_subjects sj ON sj.session_id = s.id
    JOIN subjects sub ON sub.id = sj.subject_id
    WHERE b.id = ?
  `;
        const [rows] = yield pool.query(sql, [bagId]);
        return (_a = rows[0]) !== null && _a !== void 0 ? _a : null;
    });
}
function getAllBags(conn, campaign_id) {
    return __awaiter(this, void 0, void 0, function* () {
        const sql = `
SELECT b.id as bag_id, b.bag_no
        FROM bags b
        JOIN sessions s ON b.session_id = s.id
        WHERE s.campaign_id = ?
        ORDER BY s.day_no,b.bag_no;
  `;
        const [rows] = yield conn.query(sql, [campaign_id]);
        return rows;
    });
}
function getCampaignUnlock(conn, campaign_id) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const sql = `
    SELECT is_unlock 
    FROM exam_campaigns 
    WHERE id = ?
  `;
        const [rows] = yield conn.query(sql, [campaign_id]);
        return (_b = (_a = rows[0]) === null || _a === void 0 ? void 0 : _a.is_unlock) !== null && _b !== void 0 ? _b : 0;
    });
}
function getGraderBagSummary(conn, bagId, graderId) {
    return __awaiter(this, void 0, void 0, function* () {
        const sql = `
    SELECT
      us.qr_payload,
      u.user_code,
      SUM(gs.score) AS total_score
    FROM grading_scores gs
    JOIN grading_slots s
      ON gs.slot_id = s.id
    JOIN booklets b
      ON s.booklet_id = b.id
    JOIN bags bg
      ON b.bag_id = bg.id
    JOIN user_sessions us
      ON b.user_session_id = us.id
    JOIN user_campaigns uc
      ON us.user_campaign_id = uc.id
    JOIN users u
      ON uc.user_id = u.id
    WHERE bg.id = ?
      AND gs.entered_by = ?   -- ผู้ตรวจคนนี้
    GROUP BY us.qr_payload, u.user_code
    ORDER BY u.user_code;
  `;
        const [rows] = yield conn.query(sql, [bagId, graderId]);
        return rows;
    });
}
function getGraderInfo(conn, bagId, graderId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const sql = `
SELECT
  s.question_no,
  s.grader_order,
  a.full_name
FROM grading_scores gs
join graders g on g.id = gs.entered_by
JOIN accounts a on a.id = g.account_id
JOIN grading_slots s ON gs.slot_id = s.id
JOIN booklets b ON s.booklet_id = b.id
JOIN bags bg ON b.bag_id = bg.id
JOIN user_sessions us ON b.user_session_id = us.id
JOIN user_campaigns uc ON us.user_campaign_id = uc.id
JOIN users u ON uc.user_id = u.id
WHERE bg.id = ?
  AND gs.entered_by = ?
ORDER BY u.user_code, s.question_no;
  `;
        const [rows] = yield conn.query(sql, [bagId, graderId]);
        return (_a = rows[0]) !== null && _a !== void 0 ? _a : null;
    });
}
