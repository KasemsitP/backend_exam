

import { DB } from "../model/DB";
import { Pool, PoolConnection } from "mysql2/promise";
import { RowDataPacket, ResultSetHeader } from "mysql2";

interface scoreAverage extends RowDataPacket {
  question_no: number; avg_score: number
}
interface ScoreDistributionSummary extends RowDataPacket {
  total_users: number;
  no_score: number;
}

interface ScoreBucketRow extends RowDataPacket {
  bucket_index: number; // 0..19
  count: number;
}


interface ScoreTotalRow extends RowDataPacket {
  total_score: number | null;
}

interface SubjectQuestionRow extends RowDataPacket {
  campaign_id: number;
  subject_id: number;
  subject_code: string;
  subject_name: string;
  subject_question_id: number;
  question_no: number;
  question_label: string | null;
  max_score: number | null;
  exam_date: Date;
  start_at: Date;
  end_at: Date;
}

class DashboardRepo {
  private pool: Pool
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
WHERE s.campaign_id = ?  -- ใส่ campaign ที่กำลังดู
ORDER BY s.exam_date, s.session_code;`

    const [row] = await this.pool.execute<RowDataPacket[]>(sql, [campaign_id])
    return row;
  }
  async getIsEncrypted(campaign_id: number) {
    const sql = `SELECT
  s.campaign_id,
  s.id            AS session_id,
  s.session_code,
  COUNT(us.id) AS total_users_in_session,
  SUM(CASE WHEN us.qr_payload IS NOT NULL THEN 1 ELSE 0 END) AS encrypted_users,
  SUM(CASE WHEN us.qr_payload IS NULL THEN 1 ELSE 0 END)     AS pending_users,
  CASE
    WHEN COUNT(us.id) = 0 THEN 'NO_USERS'
    WHEN SUM(CASE WHEN us.qr_payload IS NULL THEN 1 ELSE 0 END) = 0 
      THEN 'ENCRYPTED_ALL'
    ELSE 'PARTIAL'
  END AS encryption_status
FROM sessions s
LEFT JOIN user_sessions us
  ON us.session_id = s.id
 AND us.campaign_id = s.campaign_id
WHERE s.campaign_id = ?   -- campaign ที่กำลังดู
GROUP BY s.campaign_id, s.id, s.session_code
ORDER BY s.exam_date, s.session_code;`

    const [row] = await this.pool.execute<RowDataPacket[]>(sql, [campaign_id])
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

  /**  จำนวนผู้ตรวจในแต่ละ campaign */
  async getGradersCount(campaign_id: number) {
    const sql = `
      SELECT
        campaign_id,
        COUNT(*)          AS total_graders,
        COUNT(DISTINCT account_id) AS graders_with_login
      FROM graders
      WHERE campaign_id = ?
      GROUP BY campaign_id;
    `;
    const [rows] = await this.pool.execute<RowDataPacket[]>(sql, [campaign_id]);
    return rows[0] ?? null;
  }

  /**  จำนวนคีย์ใน campaign (รวม active / all) */
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

  async getAverageScorePerQuestion(
    campaignId: number
  ): Promise<{ question_no: number; avg_score: number }[]> {
    const pool = DB.getInstance();

    const sql = `
    SELECT
      s.question_no,
      AVG(gs.score) AS avg_score
    FROM grading_scores gs
    JOIN grading_slots s
      ON gs.slot_id = s.id
    JOIN booklets b
      ON s.booklet_id = b.id
    JOIN bags bg
      ON b.bag_id = bg.id
    JOIN sessions se
      ON bg.session_id = se.id
    WHERE se.campaign_id = ?
    GROUP BY s.question_no
    ORDER BY s.question_no;
  `;

    const [rows] = await pool.query<scoreAverage[]>(sql, [campaignId]);
    return rows;
  }

  /**  คะแนนเฉลี่ยในแต่ละหัวข้อ (subject_questions) จากผู้ตรวจ 2 คน (เฉลี่ย 2 แล้วค่อย avg อีกที) */

  // async getAverageScorePerQuestion(campaign_id: number) {
  //     const sql = `
  //   SELECT
  //     s.campaign_id,
  //     sub.id          AS subject_id,
  //     sub.code        AS subject_code,
  //     sub.name        AS subject_name,
  //     sq.id           AS subject_question_id,
  //     sq.question_no,
  //     sq.label        AS question_label,
  //     AVG( (gs1.score + gs2.score) / 2 ) AS avg_score
  //   FROM grading_slots sl1
  //   JOIN grading_slots sl2
  //     ON sl1.booklet_id  = sl2.booklet_id
  //    AND sl1.subject_id  = sl2.subject_id
  //    AND sl1.question_no = sl2.question_no
  //    AND sl1.grader_order = 1
  //    AND sl2.grader_order = 2
  //   JOIN grading_scores gs1
  //     ON gs1.slot_id = sl1.id
  //   JOIN grading_scores gs2
  //     ON gs2.slot_id = sl2.id
  //   JOIN booklets b
  //     ON b.id = sl1.booklet_id
  //   JOIN sessions s
  //     ON s.id = b.session_id
  //   JOIN subjects sub
  //     ON sub.id = sl1.subject_id
  //   JOIN subject_questions sq
  //     ON sq.subject_id = sub.id
  //    AND sq.question_no = sl1.question_no
  //   WHERE s.campaign_id = ?
  //   GROUP BY
  //     s.campaign_id,
  //     sub.id,
  //     sub.code,
  //     sub.name,
  //     sq.id,
  //     sq.question_no,
  //     sq.label
  //   ORDER BY sub.code, sq.question_no;
  // `;
  //     const [rows] = await this.pool.execute<RowDataPacket[]>(sql, [campaign_id]);
  //     return rows;
  // }

  /**  ช่วงคะแนน (เอาไว้ทำ chart) จาก user_campaigns.final_score */
  //  async getScoreDistribution(campaignId: number) {
  //   const pool = this.pool;

  //   // CTE พื้นฐาน คำนวณ total_score ต่อ user ใน campaign นี้
  //   const userTotalCTE = `
  //     WITH user_total AS (
  //       SELECT
  //         uc.id AS user_campaign_id,
  //         uc.user_id,
  //         SUM(gs.score) AS total_score
  //       FROM grading_scores gs
  //       JOIN grading_slots s
  //         ON gs.slot_id = s.id
  //       JOIN booklets b
  //         ON s.booklet_id = b.id
  //       JOIN bags bg
  //         ON b.bag_id = bg.id
  //       JOIN sessions se
  //         ON bg.session_id = se.id
  //       JOIN user_sessions us
  //         ON b.user_session_id = us.id
  //       JOIN user_campaigns uc
  //         ON us.user_campaign_id = uc.id
  //       WHERE se.campaign_id = ?
  //       GROUP BY uc.id, uc.user_id
  //     )
  //   `;

  //   // 1) summary: นับจำนวนคนทั้งหมด + คนที่ไม่มีคะแนน
  //   const summarySql = `
  //     ${userTotalCTE}
  //     SELECT
  //       COUNT(*) AS total_users,
  //       SUM(CASE WHEN total_score IS NULL THEN 1 ELSE 0 END) AS no_score
  //     FROM user_total;
  //   `;

  //   const [summaryRows] = await pool.query<ScoreDistributionSummary[]>(summarySql, [campaignId]);
  //   const summary = summaryRows[0] ?? { total_users: 0, no_score: 0 };

  //   // 2) buckets: แบ่งเป็นช่วง 0–4, 5–9, ..., 95–100 (step = 5)
  //   const bucketsSql = `
  //     ${userTotalCTE}
  //     SELECT
  //       CASE
  //         WHEN total_score IS NULL THEN NULL
  //         WHEN total_score < 0 THEN 0
  //         WHEN total_score >= 100 THEN 19       -- 0..19 = 20 bucket
  //         ELSE FLOOR(total_score / 5)
  //       END AS bucket_index,
  //       COUNT(*) AS count
  //     FROM user_total
  //     WHERE total_score IS NOT NULL
  //     GROUP BY bucket_index
  //     ORDER BY bucket_index;
  //   `;

  //   const [bucketRows] = await pool.query<ScoreBucketRow[]>(bucketsSql, [campaignId]);

  //   // แปลง bucket_index → label "0-4", "5-9", ..., "95-100"
  //   const buckets = bucketRows.map((r) => {
  //     const idx = r.bucket_index; // 0..19
  //     const min = idx * 5;
  //     const max = idx === 19 ? 100 : idx * 5 + 4;
  //     return {
  //       label: `${min}-${max}`,
  //       count: r.count,
  //     };
  //   });

  //   return {
  //     total_users: summary.total_users ?? 0,
  //     no_score: summary.no_score ?? 0,
  //     buckets,
  //   };
  // }
  // dashboard.repo.ts


  async getScoreDistribution(campaign_id: number) {
    // แก้ไข SQL: คำนวณ Avg รายข้อก่อน แล้วค่อย Sum ทีหลัง
    const sql = `
    WITH question_scores AS (
      SELECT
        uc.user_id,
        gs1.subject_id,
        gs1.question_no,
        -- สูตรเฉลี่ย: (คะแนนคน1 + คะแนนคน2) / 2
        -- ถ้าต้องการ: ต้องมีครบ 2 คนถึงจะคิดคะแนน (INNER JOIN grading_scores ทั้งคู่)
        (sc1.score + sc2.score) / 2 AS question_avg
      FROM booklets b
      JOIN bags bg ON b.bag_id = bg.id
      JOIN sessions se ON bg.session_id = se.id
      JOIN user_sessions us ON b.user_session_id = us.id
      JOIN user_campaigns uc ON us.user_campaign_id = uc.id
      
      -- Join Grader 1
      JOIN grading_slots gs1 
        ON gs1.booklet_id = b.id 
        AND gs1.grader_order = 1
      JOIN grading_scores sc1 
        ON sc1.slot_id = gs1.id

      -- Join Grader 2
      JOIN grading_slots gs2 
        ON gs2.booklet_id = b.id 
        AND gs2.grader_order = 2
        AND gs2.subject_id = gs1.subject_id
        AND gs2.question_no = gs1.question_no
      JOIN grading_scores sc2 
        ON sc2.slot_id = gs2.id

      WHERE se.campaign_id = ?
    ),
    user_total AS (
      SELECT
        user_id,
        SUM(question_avg) AS total_score
      FROM question_scores
      GROUP BY user_id
    )
    SELECT total_score
    FROM user_total;
  `;

    const [rows] = await this.pool.execute<ScoreTotalRow[]>(sql, [campaign_id]);

    // ---------- ส่วน Config Bucket (Logic เดิม ใช้ต่อได้เลย) ----------
    const bucketSize = 5;
    const minScore = 1;
    const maxScore = 150;

    let totalUsers = 0;
    let noScore = 0;

    const bucketMap = new Map<number, number>();

    for (const row of rows) {
      const score = row.total_score;

      if (score == null) {
        noScore++;
        continue;
      }

      totalUsers++;

      let s = Number(score);

      // clamp
      if (s < minScore) s = minScore;
      if (s > maxScore) s = maxScore;

      const bucketIndex = Math.floor((s - minScore) / bucketSize);
      bucketMap.set(bucketIndex, (bucketMap.get(bucketIndex) ?? 0) + 1);
    }

    const buckets: { label: string; count: number }[] = [];
    const maxBucketIndex = Math.floor((maxScore - minScore) / bucketSize);

    for (let idx = 0; idx <= maxBucketIndex; idx++) {
      const from = minScore + idx * bucketSize;
      let to = from + bucketSize - 1;
      if (to > maxScore) to = maxScore;

      const label = `${from}-${to}`;
      const count = bucketMap.get(idx) ?? 0;

      buckets.push({ label, count });
    }

    return {
      total_users: totalUsers,
      no_score: noScore,
      buckets,
    };
  }
  async getSubjectQuestionsByCampaign(
    campaign_id: number
  ): Promise<SubjectQuestionRow[]> {
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

  async getStatus(
    campaignId: number,
    conn: Pool | PoolConnection = this.pool
  ): Promise<any[]> {
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

    -- ✅ ยึด subject_questions ก่อน ถ้ามี, ถ้าไม่มีค่อยใช้ ss.question_count
    COALESCE(
      NULLIF(COUNT(DISTINCT sq.question_no), 0),
      ss.question_count
    ) AS question_count_effective,

    -- เอาไว้ตรวจ mismatch เฉย ๆ
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
    bic.session_id,
    gs.subject_id,
    COUNT(*) AS actual_slots,
    SUM(gs.grader_id IS NOT NULL) AS assigned_slots,
    SUM(gs.status = 'COMPLETED') AS completed_slots,
    SUM(gs.status = 'DISPUTED') AS disputed_slots,
    SUM(gs.status IN ('OPEN','ASSIGNED','DISPUTED')) AS pending_slots
  FROM grading_slots gs
  JOIN booklets_in_campaign bic ON bic.booklet_id = gs.booklet_id
  WHERE gs.grader_order IN (1,2)
  GROUP BY bic.session_id, gs.subject_id
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

  -- ✅ สรุป “ขาด slot” ชัด ๆ
  GREATEST(e.expected_slots - COALESCE(a.actual_slots,0), 0) AS missing_slots,

  -- ✅ เอาไว้ debug mismatch
  e.question_count_sq,
  e.question_count_ss,
  e.mismatch_question_count

FROM expected e
LEFT JOIN actual a
  ON a.session_id = e.session_id
 AND a.subject_id = e.subject_id
ORDER BY e.session_id, e.subject_id;

    `;

    const [slotCoverage] = await conn.query<any[]>(slotCoverageSql, [campaignId, campaignId]);
    console.log(slotCoverage)
    return slotCoverage;
  }
  async getCountBookets(campaign_id: number): Promise<number> {
    const sql = `SELECT COUNT(b.id) AS count FROM booklets b JOIN sessions s ON s.id = b.session_id WHERE s.campaign_id = ?`
    const [rows] = await this.pool.execute<RowDataPacket[]>(sql, [campaign_id]);
    return rows[0]?.count ?? 0;
  }
  async getCountBookletsBySession(campaign_id: number): Promise<{ session_id: number, session_code: string, subject_name: string, count: number }[]> {
    const sql = `SELECT 
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
ORDER BY sess.day_no;`
    const [rows] = await this.pool.execute<RowDataPacket[]>(sql, [campaign_id]);
    // console.log(rows)
    return rows.map(row => ({ session_id: row.session_id, session_code: row.session_code, subject_name: row.subject_name, count: row.count }));
  }

  async getSeatAssignedStatus(campaign_id: number): Promise<number> {
    const sql = `SELECT COUNT(b.id) AS count FROM booklets b  JOIN sessions s ON s.id = b.session_id WHERE s.campaign_id = ?`
    const [rows] = await this.pool.execute<RowDataPacket[]>(sql, [campaign_id]);
    return rows[0]?.count ?? 0;
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
  `

    const [rows] = await this.pool.execute<RowDataPacket[]>(sql, [campaign_id])
    return rows
  }


}


const dashboardRepo = new DashboardRepo()
export default dashboardRepo