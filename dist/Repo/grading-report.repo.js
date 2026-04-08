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
// ==========================================
// Helper Function
// ==========================================
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
// ==========================================
// Database Queries
// ==========================================
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
// ✅ แก้ไข: ตัด users ออก ดึงค่า b.random_num เป็น exam_code
function findQuestionAveragesForBagSubject(conn, bagId, subjectId) {
    return __awaiter(this, void 0, void 0, function* () {
        const sql = `
    SELECT
      b.id            AS booklet_id,
      b.random_num,
      b.user_code,    -- ✅ ดึง user_code ออกมาด้วยเผื่อกรณี Unblind แล้ว
      s.question_no,
      AVG(gs_q.score) AS avg_score
    FROM booklets b
    JOIN bags bg
      ON b.bag_id = bg.id
    JOIN grading_slots s
      ON s.booklet_id = b.id
    JOIN grading_scores gs_q
      ON gs_q.slot_id = s.id
    WHERE bg.id = ?            
    GROUP BY
      b.id,
      b.random_num,
      b.user_code,
      s.question_no
    ORDER BY
      b.id,
      s.question_no;
  `;
        const [rows] = yield conn.query(sql, [bagId]);
        // สร้าง exam_code ไว้หลอกๆ ก่อน Service จะเอาไปประมวลผลต่อ
        return rows.map(r => (Object.assign(Object.assign({}, r), { exam_code: r.user_code || r.random_num })));
    });
}
// ไม่ค่อยกระทบ เพราะดึงสรุปตามข้อ (ไม่ได้อ้างอิงรายบุคคลอยู่แล้ว)
function findQuestionStatsForBag(conn, bagId, subjectId) {
    return __awaiter(this, void 0, void 0, function* () {
        const sql = `
    SELECT
      s.question_no,
      sq.label,
      sq.note AS category,
      AVG(CASE WHEN s.grader_order = 1 THEN gs.score END) AS grader1_score,
      AVG(CASE WHEN s.grader_order = 2 THEN gs.score END) AS grader2_score,
      AVG(gs.score) AS final_score,
      GROUP_CONCAT(
        DISTINCT CASE WHEN s.grader_order = 1 THEN a.full_name END
        ORDER BY a.full_name SEPARATOR ', '
      ) AS grader1_names,
      GROUP_CONCAT(
        DISTINCT CASE WHEN s.grader_order = 2 THEN a.full_name END
        ORDER BY a.full_name SEPARATOR ', '
      ) AS grader2_names
    FROM booklets b
    JOIN bags bg ON b.bag_id = bg.id
    JOIN grading_slots s ON s.booklet_id = b.id
    JOIN grading_scores gs ON gs.slot_id = s.id
    LEFT JOIN subject_questions sq
      ON sq.subject_id = s.subject_id AND sq.question_no = s.question_no
    LEFT JOIN graders g ON g.id = gs.entered_by
    LEFT JOIN accounts a ON a.id = g.account_id
    WHERE bg.id = ?
    GROUP BY s.question_no, sq.label, sq.note
    ORDER BY s.question_no;
  `;
        const [rows] = yield conn.query(sql, [bagId]);
        return rows;
    });
}
function findBookletQuestionStatsForBag(conn, bagId, subjectId) {
    return __awaiter(this, void 0, void 0, function* () {
        const sql = `
    SELECT
      b.id          AS booklet_id,
      b.random_num,
      b.user_code,
      -- 🛑 Fetch student names for Unlocked mode
      u.title,
      u.full_name,
      u.first_name,
      u.last_name,

      s.question_no,
      sq.label,
      sq.note       AS category,

MAX(CASE WHEN s.grader_order = 1 THEN gs.score END) AS grader1_score,
MAX(CASE WHEN s.grader_order = 2 THEN gs.score END) AS grader2_score,
      AVG(gs.score) AS final_score,

      GROUP_CONCAT(
        DISTINCT CASE WHEN s.grader_order = 1 THEN a.full_name END
        ORDER BY a.full_name SEPARATOR ', '
      ) AS grader1_names,
      GROUP_CONCAT(
        DISTINCT CASE WHEN s.grader_order = 2 THEN a.full_name END
        ORDER BY a.full_name SEPARATOR ', '
      ) AS grader2_names

    FROM bags bg
    LEFT JOIN booklets b
      ON b.bag_id = bg.id
    
    -- 🛑 JOIN the users table to get the names
    LEFT JOIN users u 
      ON u.user_code = b.user_code

    LEFT JOIN grading_slots s
      ON s.booklet_id = b.id
    LEFT JOIN grading_scores gs
      ON gs.slot_id = s.id
    LEFT JOIN subject_questions sq
      ON sq.subject_id = s.subject_id AND sq.question_no = s.question_no
    LEFT JOIN graders g
      ON g.id = gs.entered_by
    LEFT JOIN accounts a
      ON a.id = g.account_id
    WHERE bg.id = ?
    GROUP BY
      b.id,
      b.random_num,
      b.user_code,
      u.title,
      u.full_name,   -- 🛑 Add to GROUP BY
      u.first_name,  -- 🛑 Add to GROUP BY
      u.last_name,   -- 🛑 Add to GROUP BY
      s.question_no,
      sq.label,
      sq.note
    ORDER BY
      b.id,
      s.question_no;
  `;
        const [rows] = yield conn.query(sql, [bagId]);
        //console.log("RawBookletQuestionStatsRow results:", rows);
        return rows.map(r => (Object.assign(Object.assign({}, r), { exam_code: r.user_code || r.random_num })));
    });
}
function getUnlockCampaignByBagId(conn, bagId) {
    return __awaiter(this, void 0, void 0, function* () {
        const sql = `
    SELECT s.campaign_id , ec.is_unlock 
    FROM bags b 
    JOIN sessions s ON s.id = b.session_id 
    JOIN exam_campaigns ec ON ec.id = s.campaign_id 
    WHERE b.id = ?;
  `;
        const [rows] = yield conn.query(sql, [bagId]);
        return rows;
    });
}
function getUnlockCampaignNoconn(bagId) {
    return __awaiter(this, void 0, void 0, function* () {
        const pool = DB_1.DB.getInstance();
        const sql = `
    SELECT s.campaign_id , ec.is_unlock 
    FROM bags b 
    JOIN sessions s ON s.id = b.session_id 
    JOIN exam_campaigns ec ON ec.id = s.campaign_id 
    WHERE b.id = ?;
  `;
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
    ORDER BY s.day_no, b.bag_no;
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
      b.random_num,
      b.user_code, -- ✅ ดึง user_code ด้วย
      SUM(gs.score) AS total_score
    FROM grading_scores gs
    JOIN grading_slots s
      ON gs.slot_id = s.id
    JOIN booklets b
      ON s.booklet_id = b.id
    JOIN bags bg
      ON b.bag_id = bg.id
    WHERE bg.id = ?
      AND gs.entered_by = ?   
    GROUP BY b.random_num, b.user_code
    ORDER BY b.random_num;
  `;
        const [rows] = yield conn.query(sql, [bagId, graderId]);
        // แปลงให้ตรงกับ Type เดิม
        return rows.map(r => ({
            exam_code: r.user_code || r.random_num,
            total_score: r.total_score
        }));
    });
}
// ✅ แก้ไข: ตัด users ออก เปลี่ยนการจัดเรียงมาอิง random_num แทน
function getGraderInfo(conn, bagId, graderId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const sql = `
    SELECT
      s.question_no,
      s.grader_order,
      a.full_name
    FROM grading_scores gs
    JOIN graders g ON g.id = gs.entered_by
    JOIN accounts a ON a.id = g.account_id
    JOIN grading_slots s ON gs.slot_id = s.id
    JOIN booklets b ON s.booklet_id = b.id
    JOIN bags bg ON b.bag_id = bg.id
    WHERE bg.id = ?
      AND gs.entered_by = ?
    ORDER BY b.random_num, s.question_no;
  `;
        const [rows] = yield conn.query(sql, [bagId, graderId]);
        return (_a = rows[0]) !== null && _a !== void 0 ? _a : null;
    });
}
