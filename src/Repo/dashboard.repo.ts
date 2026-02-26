// Repo/dashboard.repo.ts
import { DB } from "../model/DB";
import { Pool, PoolConnection } from "mysql2/promise";
import { RowDataPacket } from "mysql2";

interface scoreAverage extends RowDataPacket {
  question_no: number;
  avg_score: number;
}

interface SubjectQuestionRow extends RowDataPacket {
  campaign_id: number;
  subject_id: number;
  subject_code: string;
  subject_name: string;
  subject_question_id: number | null;
  question_no: number | null;
  question_label: string | null;
  max_score: number | null;
  exam_date: Date;
  start_at: Date;
  end_at: Date;
}

class DashboardRepo {
  private pool: Pool;

  constructor() {
    this.pool = DB.getInstance();
  }

  async getCampaignBasicCounts(campaign_id: number) {
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
    const [rows] = await this.pool.execute<RowDataPacket[]>(sql, [campaign_id]);
    return rows[0] ?? null;
  }

  async getStatusSession(campaign_id: number) {
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

    const [row] = await this.pool.execute<RowDataPacket[]>(sql, [campaign_id]);
    return row;
  }

  async getIsEncrypted(campaign_id: number) {
    const sql = `SELECT
      s.campaign_id,
      s.id AS session_id,
      s.session_code,

      COUNT(us.id) AS total_users_in_session,
      SUM(CASE WHEN us.qr_payload IS NOT NULL THEN 1 ELSE 0 END) AS encrypted_users,
      SUM(CASE WHEN us.qr_payload IS NULL THEN 1 ELSE 0 END) AS pending_users,

      COUNT(DISTINCT ss.subject_id) AS subject_count,

      CASE
        WHEN COUNT(DISTINCT ss.subject_id) = 0 THEN 'NO_SESSION_SUBJECT'
        WHEN COUNT(us.id) = 0 THEN 'NO_USERS'
        WHEN SUM(CASE WHEN us.qr_payload IS NULL THEN 1 ELSE 0 END) = 0 THEN 'ENCRYPTED_ALL'
        ELSE 'PARTIAL'
      END AS encryption_status

    FROM sessions s
    LEFT JOIN session_subjects ss
      ON ss.session_id = s.id
    LEFT JOIN user_sessions us
      ON us.session_id = s.id
    AND us.campaign_id = s.campaign_id

    WHERE s.campaign_id = ?

    GROUP BY
      s.campaign_id, s.id, s.session_code

    ORDER BY
      s.exam_date, s.session_code;`;

    const [row] = await this.pool.execute<RowDataPacket[]>(sql, [campaign_id]);
    return row;
  }

  async getBagCountsPerSession(campaign_id: number) {
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
    const [rows] = await this.pool.execute<RowDataPacket[]>(sql, [campaign_id]);
    return rows;
  }

  async getGradersCount(campaign_id: number) {
    const sql = `
      SELECT
        campaign_id,
        COUNT(*) AS total_graders,
        COUNT(DISTINCT account_id) AS graders_with_login
      FROM graders
      WHERE campaign_id = ?
      GROUP BY campaign_id;
    `;
    const [rows] = await this.pool.execute<RowDataPacket[]>(sql, [campaign_id]);
    return rows[0] ?? null;
  }

  async getKeyCounts(campaign_id: number) {
    const sql = `
      SELECT
        campaign_id,
        COUNT(*) AS total_keys,
        SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) AS active_keys
      FROM campaign_keys
      WHERE campaign_id = ?
      GROUP BY campaign_id;
    `;
    const [rows] = await this.pool.execute<RowDataPacket[]>(sql, [campaign_id]);
    return rows[0] ?? null;
  }

  async getAverageScorePerQuestion(campaignId: number): Promise<{ question_no: number; avg_score: number }[]> {
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
    const [rows] = await this.pool.query<scoreAverage[]>(sql, [campaignId]);
    return rows;
  }

  /**
   * ✅ NEW: score distribution bucketed in SQL (ไม่ดึง total_score ทั้งหมดขึ้น Node)
   * หมายเหตุ: ใช้ logic เดิมของคุณ: "คิด avg รายข้อ (2 คน) ก่อน แล้ว sum"
   */
  async getScoreDistributionBucketed(campaign_id: number) {
    const bucketSize = 5;
    const minScore = 1;
    const maxScore = 150;

    // จำนวน bucket = 1..150 step 5 => 30 bucket (index 0..29)
    const maxBucketIndex = Math.floor((maxScore - minScore) / bucketSize);

    const sql = `
WITH slot_scores AS (
  SELECT
    b.user_session_id,
    gs.subject_id,
    gs.question_no,
    SUM(gsc.score) / 2 AS question_avg,
    COUNT(gsc.score) AS score_count
  FROM booklets b
  JOIN sessions se ON se.id = b.session_id
  JOIN grading_slots gs ON gs.booklet_id = b.id AND gs.grader_order IN (1, 2)
  JOIN grading_scores gsc ON gsc.slot_id = gs.id
  WHERE se.campaign_id = ?
  GROUP BY b.user_session_id, gs.subject_id, gs.question_no
  HAVING score_count = 2
),
user_total AS (
  SELECT
    us.user_campaign_id,
    SUM(ss.question_avg) AS total_score
  FROM slot_scores ss
  JOIN user_sessions us ON us.id = ss.user_session_id
  GROUP BY us.user_campaign_id
),
summary AS (
  SELECT
    COUNT(*) AS total_users,
    SUM(CASE WHEN total_score IS NULL THEN 1 ELSE 0 END) AS no_score
  FROM user_total
),
bucketed AS (
  SELECT
    LEAST(
      ${maxBucketIndex},
      GREATEST(
        0,
        FLOOR((LEAST(${maxScore}, GREATEST(${minScore}, total_score)) - ${minScore}) / ${bucketSize})
      )
    ) AS bucket_index,
    COUNT(*) AS count
  FROM user_total
  WHERE total_score IS NOT NULL
  GROUP BY bucket_index
)
SELECT
  s.total_users,
  s.no_score,
  b.bucket_index,
  b.count
FROM summary s
LEFT JOIN bucketed b ON 1=1
ORDER BY b.bucket_index;
    `;

    const [rows] = await this.pool.execute<RowDataPacket[]>(sql, [campaign_id]);

    const total_users = Number(rows[0]?.total_users ?? 0);
    const no_score = Number(rows[0]?.no_score ?? 0);

    // map bucket_index -> count
    const bucketMap = new Map<number, number>();
    for (const r of rows) {
      if (r.bucket_index == null) continue;
      bucketMap.set(Number(r.bucket_index), Number(r.count ?? 0));
    }

    const buckets: { label: string; count: number }[] = [];
    for (let idx = 0; idx <= maxBucketIndex; idx++) {
      const from = minScore + idx * bucketSize;
      let to = from + bucketSize - 1;
      if (to > maxScore) to = maxScore;
      buckets.push({ label: `${from}-${to}`, count: bucketMap.get(idx) ?? 0 });
    }

    return { total_users, no_score, buckets };
  }

  async getSubjectQuestionsByCampaign(campaign_id: number): Promise<SubjectQuestionRow[]> {
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
    const [rows] = await this.pool.execute<SubjectQuestionRow[]>(sql, [campaign_id]);
    return rows;
  }

  /**
   * (เดิม) heavy coverage → ใช้กับ debug endpoint หรือ cache นาน
   */
  async getStatus(campaignId: number, conn: Pool | PoolConnection = this.pool): Promise<any[]> {
    const slotCoverageSql = `
WITH booklets_in_campaign AS (
  SELECT b.id AS booklet_id, b.session_id
  FROM booklets b
  JOIN user_sessions us ON us.id = b.user_session_id
  WHERE us.campaign_id = ?
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

    const [slotCoverage] = await conn.query<any[]>(slotCoverageSql, [campaignId, campaignId, campaignId]);
    return slotCoverage;
  }

  async getCountBookets(campaign_id: number): Promise<number> {
    const sql = `
      SELECT COUNT(b.id) AS count
      FROM booklets b
      JOIN sessions s ON s.id = b.session_id
      WHERE s.campaign_id = ?
    `;
    const [rows] = await this.pool.execute<RowDataPacket[]>(sql, [campaign_id]);
    return Number(rows[0]?.count ?? 0);
  }

  async getCountBookletsBySession(campaign_id: number): Promise<{ session_id: number; session_code: string; subject_name: string; count: number }[]> {
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
    const [rows] = await this.pool.execute<RowDataPacket[]>(sql, [campaign_id]);
    return rows.map((row) => ({
      session_id: Number(row.session_id),
      session_code: row.session_code,
      subject_name: row.subject_name,
      count: Number(row.count ?? 0),
    }));
  }

  async isAssigned(campaign_id: number): Promise<any> {
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
    const [rows] = await this.pool.execute<RowDataPacket[]>(sql, [campaign_id]);
    return rows;
  }

  /**
   * ✅ NEW: optimized average question score (no pivot, no group_concat)
   */
  async getAverageQuestionScoreOptimized(campaign_id: number): Promise<any[]> {
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
    const [rows] = await this.pool.execute<RowDataPacket[]>(sql, [campaign_id]);
    return rows;
  }
}

const dashboardRepo = new DashboardRepo();
export default dashboardRepo;