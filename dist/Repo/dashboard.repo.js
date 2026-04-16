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
// Repo/dashboard.repo.ts
const DB_1 = require("../model/DB");
class DashboardRepo {
    constructor() {
        this.pool = DB_1.DB.getInstance();
    }
    getCampaignBasicCounts(campaign_id) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const sql = `
      SELECT
        c.id AS campaign_id,
        COUNT(DISTINCT s.id)          AS session_count,
        COUNT(DISTINCT ss.subject_id) AS subject_count
      FROM exam_campaigns c
      LEFT JOIN sessions s
        ON s.campaign_id = c.id
      LEFT JOIN session_subjects ss
        ON ss.session_id = s.id
      WHERE c.id = ?
      GROUP BY c.id;
    `;
            const [rows] = yield this.pool.execute(sql, [campaign_id]);
            return (_a = rows[0]) !== null && _a !== void 0 ? _a : null;
        });
    }
    getStatusSession(campaign_id) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `WITH uc AS (
      SELECT campaign_id, COUNT(*) AS users_in_campaign
      FROM user_campaigns
      GROUP BY campaign_id
    ),
    us_count AS (
      SELECT campaign_id, session_id, COUNT(*) AS users_in_session
      FROM user_sessions
      GROUP BY campaign_id, session_id
    )
    SELECT
      s.campaign_id,
      s.id           AS session_id,
      s.session_code,
      subj.name AS subject_name,
      COALESCE(uc.users_in_campaign, 0)  AS users_in_campaign,
      COALESCE(us_count.users_in_session, 0) AS users_in_session,
      CASE 
        WHEN COALESCE(us_count.users_in_session, 0) = 0 THEN 'NOT_IMPORTED'
        ELSE 'IMPORTED'
      END AS import_status
    FROM sessions s
    LEFT JOIN uc 
      ON uc.campaign_id = s.campaign_id
    LEFT JOIN us_count 
      ON us_count.campaign_id = s.campaign_id
    AND us_count.session_id  = s.id
    LEFT JOIN session_subjects sj
      ON sj.session_id = s.id
    LEFT JOIN subjects subj
      ON subj.id = sj.subject_id
    WHERE s.campaign_id = ?
    ORDER BY s.exam_date, s.session_code;`;
            const [row] = yield this.pool.execute(sql, [campaign_id]);
            return row;
        });
    }
    getIsEncrypted(campaign_id) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
      SELECT
        session_stats.campaign_id,
        session_stats.session_id,
        session_stats.session_code,
        
        session_stats.total_users_in_session,
        session_stats.encrypted_users,
        GREATEST(session_stats.total_users_in_session - session_stats.encrypted_users, 0) AS pending_users,
        
        session_stats.subject_count,
        
        CASE
          WHEN session_stats.subject_count = 0 THEN 'NO_SESSION_SUBJECT'
          WHEN session_stats.total_users_in_session = 0 THEN 'NO_USERS'
          WHEN session_stats.total_users_in_session <= session_stats.encrypted_users THEN 'ENCRYPTED_ALL'
          ELSE 'PARTIAL'
        END AS encryption_status

      FROM (
        SELECT
          s.campaign_id,
          s.id AS session_id,
          s.session_code,
          s.exam_date,
          
          (SELECT COUNT(id) FROM user_sessions us WHERE us.session_id = s.id) AS total_users_in_session,
          (SELECT COUNT(id) FROM booklets b WHERE b.session_id = s.id) AS encrypted_users,
          (SELECT COUNT(DISTINCT subject_id) FROM session_subjects ss WHERE ss.session_id = s.id) AS subject_count
          
        FROM sessions s
        WHERE s.campaign_id = ?
      ) AS session_stats

      ORDER BY
        session_stats.exam_date, 
        session_stats.session_code;
    `;
            const [row] = yield this.pool.execute(sql, [campaign_id]);
            return row;
        });
    }
    getBagCountsPerSession(campaign_id) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
      SELECT
        s.campaign_id,
        s.id AS session_id,
        s.session_code,
        GROUP_CONCAT(DISTINCT subj.name SEPARATOR ', ') AS subject_name,
        COUNT(DISTINCT b.id) AS total_bags,
        COALESCE(SUM(DISTINCT b.count_items), 0) AS total_capacity
      FROM sessions s
      LEFT JOIN session_subjects sj
        ON sj.session_id = s.id
      LEFT JOIN subjects subj
        ON subj.id = sj.subject_id
      LEFT JOIN bags b
        ON b.session_id = s.id
      WHERE s.campaign_id = ?
      GROUP BY s.campaign_id, s.id, s.session_code
      ORDER BY s.exam_date, s.session_code;
    `;
            const [rows] = yield this.pool.execute(sql, [campaign_id]);
            return rows;
        });
    }
    getGradersCount(campaign_id) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const sql = `
      SELECT
        campaign_id,
        COUNT(*) AS total_graders,
        COUNT(DISTINCT account_id) AS graders_with_login
      FROM graders
      WHERE campaign_id = ?
      GROUP BY campaign_id;
    `;
            const [rows] = yield this.pool.execute(sql, [campaign_id]);
            return (_a = rows[0]) !== null && _a !== void 0 ? _a : null;
        });
    }
    getKeyCounts(campaign_id) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const sql = `
      SELECT
        campaign_id,
        COUNT(*) AS total_keys,
        SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) AS active_keys
      FROM campaign_keys
      WHERE campaign_id = ?
      GROUP BY campaign_id;
    `;
            const [rows] = yield this.pool.execute(sql, [campaign_id]);
            return (_a = rows[0]) !== null && _a !== void 0 ? _a : null;
        });
    }
    getAverageScorePerQuestion(campaignId) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
      SELECT
        s.question_no,
        AVG(gs.score) AS avg_score
      FROM grading_scores gs
      JOIN grading_slots s
        ON gs.slot_id = s.id
      JOIN booklets b
        ON s.booklet_id = b.id
      JOIN sessions se
        ON b.session_id = se.id
      WHERE se.campaign_id = ?
      GROUP BY s.question_no
      ORDER BY s.question_no;
    `;
            const [rows] = yield this.pool.query(sql, [campaignId]);
            return rows;
        });
    }
    getScoreDistributionBucketed(campaign_id) {
        return __awaiter(this, void 0, void 0, function* () {
            // 1. ดึงจำนวนผู้มีสิทธิ์สอบรวมทั้งแคมเปญ
            const [[{ total_camp_users }]] = yield this.pool.execute(`SELECT COUNT(*) AS total_camp_users FROM user_campaigns WHERE campaign_id = ?`, [campaign_id]);
            // 2. ดึงจำนวนผู้มีสิทธิ์สอบแยกตาม Session
            const [sessionUsers] = yield this.pool.execute(`SELECT session_id, COUNT(*) AS count FROM user_sessions WHERE campaign_id = ? GROUP BY session_id`, [campaign_id]);
            const sessionUserMap = new Map(sessionUsers.map((s) => [s.session_id, s.count]));
            // 3. 🌟 ดึง Max Score ของแต่ละ Session ตามที่กำหนดในโครงสร้างข้อสอบ
            const [sessionMaxScoresRaw] = yield this.pool.execute(`
      SELECT 
        se.id AS session_id,
        COALESCE(SUM(sq.max_score), 0) AS max_score
      FROM sessions se
      LEFT JOIN session_subjects ss ON ss.session_id = se.id
      LEFT JOIN subject_questions sq ON sq.subject_id = ss.subject_id
      WHERE se.campaign_id = ?
      GROUP BY se.id
    `, [campaign_id]);
            const sessionMaxScoreMap = new Map();
            let campaignTotalMaxScore = 0; // คะแนนเต็มรวม 3 วัน
            sessionMaxScoresRaw.forEach((row) => {
                const score = Number(row.max_score);
                sessionMaxScoreMap.set(row.session_id, score);
                campaignTotalMaxScore += score;
            });
            // 4. ดึงคะแนนรวมของแต่ละ "เล่ม" ที่ตรวจเสร็จสมบูรณ์แล้ว
            const sql = `
      SELECT
        t.booklet_id,
        t.session_id,
        s.session_code,
        t.user_code,
        SUM(t.q_avg) AS final_score
      FROM (
        SELECT
          b.id AS booklet_id,
          b.session_id,
          b.user_code,
          gs.subject_id,
          gs.question_no,
          SUM(gsc.score)/2 AS q_avg
        FROM booklets b
        JOIN grading_slots gs ON gs.booklet_id = b.id AND gs.grader_order IN (1,2)
        JOIN grading_scores gsc ON gsc.slot_id = gs.id
        JOIN sessions se ON se.id = b.session_id
        WHERE se.campaign_id = ?
        GROUP BY b.id, b.session_id, b.user_code, gs.subject_id, gs.question_no
        HAVING COUNT(gsc.score) = 2
      ) t
      JOIN sessions s ON s.id = t.session_id
      GROUP BY t.booklet_id, t.session_id, s.session_code, t.user_code
    `;
            const [booklets] = yield this.pool.execute(sql, [campaign_id]);
            // --- Helper: ฟังก์ชันจัดกลุ่มลงกราฟ โดยใช้เพดานคะแนน (exactMaxScore) อัตโนมัติ ---
            const buildBuckets = (scores, totalUsers, exactMaxScore) => {
                var _a;
                const bucketSize = 5;
                // ดันเพดานกราฟให้เท่ากับคะแนนเต็ม (หรือถ้าบังเอิญมีคนได้คะแนนเกิน ก็ให้กราฟยืดตาม)
                const chartMax = Math.max(exactMaxScore > 0 ? exactMaxScore : 50, ...scores);
                const maxBucketIndex = Math.floor((chartMax - 1) / bucketSize);
                const bucketMap = new Map();
                scores.forEach(s => {
                    const idx = Math.max(0, Math.floor((s - 1) / bucketSize));
                    bucketMap.set(idx, (bucketMap.get(idx) || 0) + 1);
                });
                const buckets = [];
                for (let idx = 0; idx <= maxBucketIndex; idx++) {
                    const from = 1 + idx * bucketSize;
                    const to = from + bucketSize - 1;
                    buckets.push({ label: `${from}-${to}`, count: (_a = bucketMap.get(idx)) !== null && _a !== void 0 ? _a : 0 });
                }
                return {
                    totalUsers: Number(totalUsers),
                    noScore: Math.max(0, Number(totalUsers) - scores.length),
                    buckets
                };
            };
            const sessionScores = {};
            let isUnlocked = false;
            booklets.forEach((b) => {
                if (b.user_code)
                    isUnlocked = true;
                if (!sessionScores[b.session_id]) {
                    sessionScores[b.session_id] = { sessionCode: b.session_code, scores: [] };
                }
                sessionScores[b.session_id].scores.push(Number(b.final_score));
            });
            // 5. สร้างข้อมูลกราฟราย Session (ส่ง Max Score เฉพาะ Session นั้นๆ ไปให้)
            const sessionDistributions = Object.keys(sessionScores).map(sid => {
                const numSid = Number(sid);
                const data = sessionScores[numSid];
                return Object.assign({ sessionId: numSid, sessionCode: data.sessionCode }, buildBuckets(data.scores, sessionUserMap.get(numSid) || 0, sessionMaxScoreMap.get(numSid) || 50));
            });
            // 6. สร้างข้อมูลกราฟรวม (ส่ง Max Score แบบรวมทุก Session ไปให้)
            let totalDistribution = null;
            if (isUnlocked) {
                const userTotalMap = new Map();
                booklets.forEach((b) => {
                    if (b.user_code) {
                        userTotalMap.set(b.user_code, (userTotalMap.get(b.user_code) || 0) + Number(b.final_score));
                    }
                });
                totalDistribution = buildBuckets(Array.from(userTotalMap.values()), total_camp_users, campaignTotalMaxScore);
            }
            return {
                isUnlocked,
                totalDistribution,
                sessionDistributions
            };
        });
    }
    getSubjectQuestionsByCampaign(campaign_id) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
      SELECT
        se.campaign_id,
        se.id           AS session_id,
        se.session_code,
        se.exam_date,
        ss.start_at,
        ss.end_at,

        sub.id          AS subject_id,
        sub.code        AS subject_code,
        sub.name        AS subject_name,

        sq.id           AS subject_question_id,
        sq.question_no,
        sq.label        AS question_label,
        sq.max_score
      FROM sessions se
      JOIN session_subjects ss
        ON ss.session_id = se.id
      JOIN subjects sub
        ON sub.id = ss.subject_id
      LEFT JOIN subject_questions sq
        ON sq.subject_id = sub.id
      WHERE se.campaign_id = ?
      ORDER BY se.exam_date, se.session_code, sub.code, sq.question_no;
    `;
            const [rows] = yield this.pool.execute(sql, [campaign_id]);
            return rows;
        });
    }
    /**
     * (เดิม) heavy coverage → ใช้กับ debug endpoint หรือ cache นาน
     */
    getStatus(campaignId_1) {
        return __awaiter(this, arguments, void 0, function* (campaignId, conn = this.pool) {
            const slotCoverageSql = `
WITH booklets_in_campaign AS (
  SELECT b.id AS booklet_id, b.session_id
  FROM booklets b
  JOIN sessions s ON s.id = b.session_id -- ✅ แก้ไขการเชื่อมต่อเป็น sessions โดยตรง
  WHERE s.campaign_id = ? AND b.status IN ('PACKAGED')
),
booklet_counts AS (
  SELECT session_id, COUNT(*) AS booklet_count
  FROM booklets_in_campaign
  GROUP BY session_id
),
question_counts AS (
  SELECT
    ss.session_id,
    ss.subject_id,
    COALESCE(NULLIF(COUNT(DISTINCT sq.question_no), 0), ss.question_count) AS question_count_effective,
    COUNT(DISTINCT sq.question_no) AS question_count_sq,
    ss.question_count AS question_count_ss,
    (COUNT(DISTINCT sq.question_no) <> ss.question_count) AS mismatch_question_count
  FROM session_subjects ss
  JOIN sessions se ON se.id = ss.session_id
  LEFT JOIN subject_questions sq
    ON sq.subject_id = ss.subject_id
  WHERE se.campaign_id = ?
  GROUP BY ss.session_id, ss.subject_id, ss.question_count
),
expected AS (
  SELECT
    qc.session_id,
    qc.subject_id,
    bc.booklet_count,
    qc.question_count_effective AS question_count,
    (bc.booklet_count * qc.question_count_effective * 2) AS expected_slots,
    qc.question_count_sq,
    qc.question_count_ss,
    qc.mismatch_question_count
  FROM question_counts qc
  JOIN booklet_counts bc ON bc.session_id = qc.session_id
),
actual AS (
  SELECT
    b.session_id,
    gs.subject_id,
    COUNT(*) AS actual_slots,
    SUM(CASE WHEN gs.grader_id IS NOT NULL THEN 1 ELSE 0 END) AS assigned_slots,
    SUM(CASE WHEN gs.status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_slots,
    SUM(CASE WHEN gs.status = 'DISPUTED' THEN 1 ELSE 0 END) AS disputed_slots,
    SUM(CASE WHEN gs.status IN ('OPEN','ASSIGNED','DISPUTED') THEN 1 ELSE 0 END) AS pending_slots
  FROM grading_slots gs
  JOIN booklets b ON b.id = gs.booklet_id
  JOIN sessions se ON se.id = b.session_id
  WHERE se.campaign_id = ? AND gs.grader_order IN (1,2)
  GROUP BY b.session_id, gs.subject_id
)
SELECT
  e.session_id,
  e.subject_id,
  e.booklet_count,
  e.question_count,
  e.expected_slots,

  COALESCE(a.actual_slots,0)     AS actual_slots,
  COALESCE(a.assigned_slots,0)   AS assigned_slots,
  COALESCE(a.completed_slots,0)  AS completed_slots,
  COALESCE(a.disputed_slots,0)   AS disputed_slots,
  COALESCE(a.pending_slots,0)    AS pending_slots,

  GREATEST(e.expected_slots - COALESCE(a.actual_slots,0), 0) AS missing_slots,

  e.question_count_sq,
  e.question_count_ss,
  e.mismatch_question_count

FROM expected e
LEFT JOIN actual a
  ON a.session_id = e.session_id
 AND a.subject_id = e.subject_id
ORDER BY e.session_id, e.subject_id;
    `;
            const [slotCoverage] = yield conn.query(slotCoverageSql, [campaignId, campaignId, campaignId]);
            return slotCoverage;
        });
    }
    getCountBookets(campaign_id) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const sql = `
      SELECT COUNT(b.id) AS count
      FROM booklets b
      JOIN sessions s ON s.id = b.session_id
      WHERE s.campaign_id = ?
    `;
            const [rows] = yield this.pool.execute(sql, [campaign_id]);
            return Number((_b = (_a = rows[0]) === null || _a === void 0 ? void 0 : _a.count) !== null && _b !== void 0 ? _b : 0);
        });
    }
    getCountBookletsBySession(campaign_id) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
      SELECT 
        sess.id as session_id,
        s.name as subject_name,
        sess.session_code,
        COUNT(DISTINCT b.id) AS count
      FROM subjects s
      JOIN session_subjects ss 
        ON s.id = ss.subject_id
      JOIN sessions sess 
        ON sess.id = ss.session_id 
       AND sess.campaign_id = ?
      LEFT JOIN booklets b 
        ON b.session_id = sess.id
      GROUP BY s.name, sess.day_no , sess.id
      ORDER BY sess.day_no;
    `;
            const [rows] = yield this.pool.execute(sql, [campaign_id]);
            return rows.map((row) => {
                var _a;
                return ({
                    session_id: Number(row.session_id),
                    session_code: row.session_code,
                    subject_name: row.subject_name,
                    count: Number((_a = row.count) !== null && _a !== void 0 ? _a : 0),
                });
            });
        });
    }
    isAssigned(campaign_id) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
      SELECT 
        r.room_code,
        COUNT(uc.user_id) AS count_user,
        r.capacity
      FROM exam_rooms r
      LEFT JOIN user_campaigns uc
        ON uc.room_code = r.room_code
      AND uc.campaign_id = r.campaign_id
      WHERE r.campaign_id = ?
      GROUP BY r.room_code, r.capacity;
    `;
            const [rows] = yield this.pool.execute(sql, [campaign_id]);
            return rows;
        });
    }
    /**
     * ✅ NEW: optimized average question score (no pivot, no group_concat)
     */
    getAverageQuestionScoreOptimized(campaign_id) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
      SELECT
        b.session_id,
        gs.subject_id,
        gs.question_no,
        sq.label,
        sq.note AS category,

        AVG(CASE WHEN gs.grader_order = 1 THEN gsc.score END) AS grader1_avg,
        AVG(CASE WHEN gs.grader_order = 2 THEN gsc.score END) AS grader2_avg,
        AVG(CASE WHEN gs.grader_order IN (1,2) THEN gsc.score END) AS final_avg,

        SUM(CASE WHEN gs.grader_order = 1 THEN 1 ELSE 0 END) AS n1,
        SUM(CASE WHEN gs.grader_order = 2 THEN 1 ELSE 0 END) AS n2

      FROM grading_scores gsc
      JOIN grading_slots gs
        ON gs.id = gsc.slot_id
       AND gs.grader_order IN (1,2)
      JOIN booklets b
        ON b.id = gs.booklet_id
      JOIN sessions se
        ON se.id = b.session_id
       AND se.campaign_id = ?
      LEFT JOIN subject_questions sq
        ON sq.subject_id = gs.subject_id
       AND sq.question_no = gs.question_no

      GROUP BY
        b.session_id, gs.subject_id, gs.question_no, sq.label, sq.note
      ORDER BY
        b.session_id, gs.question_no;
    `;
            const [rows] = yield this.pool.execute(sql, [campaign_id]);
            return rows;
        });
    }
}
const dashboardRepo = new DashboardRepo();
exports.default = dashboardRepo;
