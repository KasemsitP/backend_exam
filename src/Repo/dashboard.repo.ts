

import { DB } from "../model/DB";
import { Pool, PoolConnection } from "mysql2/promise";
import { RowDataPacket, ResultSetHeader } from "mysql2";



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
        s.id           AS session_id,
        s.session_code,
        COUNT(b.id)    AS total_bags,
        SUM(b.count_items) AS total_capacity
      FROM sessions s
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

    /**  คะแนนเฉลี่ยในแต่ละหัวข้อ (subject_questions) จากผู้ตรวจ 2 คน (เฉลี่ย 2 แล้วค่อย avg อีกที) */
    async getAverageScorePerQuestion(campaign_id: number) {
        const sql = `
      SELECT
        s.campaign_id,
        sub.id          AS subject_id,
        sub.code        AS subject_code,
        sub.name        AS subject_name,
        sq.id           AS subject_question_id,
        sq.question_no,
        sq.label        AS question_label,
        AVG( (gs1.score + gs2.score) / 2 ) AS avg_score
      FROM grading_slots sl1
      JOIN grading_slots sl2
        ON sl1.booklet_id  = sl2.booklet_id
       AND sl1.subject_id  = sl2.subject_id
       AND sl1.question_no = sl2.question_no
       AND sl1.grader_order = 1
       AND sl2.grader_order = 2
      JOIN grading_scores gs1
        ON gs1.slot_id = sl1.id
      JOIN grading_scores gs2
        ON gs2.slot_id = sl2.id
      JOIN booklets b
        ON b.id = sl1.booklet_id
      JOIN sessions s
        ON s.id = b.session_id
      JOIN subjects sub
        ON sub.id = sl1.subject_id
      JOIN subject_questions sq
        ON sq.subject_id = sub.id
       AND sq.question_no = sl1.question_no
      WHERE s.campaign_id = ?
      GROUP BY
        s.campaign_id,
        sub.id,
        sub.code,
        sub.name,
        sq.id,
        sq.question_no,
        sq.label
      ORDER BY sub.code, sq.question_no;
    `;
        const [rows] = await this.pool.execute<RowDataPacket[]>(sql, [campaign_id]);
        return rows;
    }

    /**  ช่วงคะแนน (เอาไว้ทำ chart) จาก user_campaigns.final_score */
    async getScoreDistribution(campaign_id: number) {
        const sql = `
      SELECT
        campaign_id,
        COUNT(*) AS total_users,
        SUM(CASE WHEN final_score IS NULL THEN 1 ELSE 0 END) AS no_score,
        SUM(CASE WHEN final_score >= 0  AND final_score < 25  THEN 1 ELSE 0 END) AS bucket_0_24,
        SUM(CASE WHEN final_score >= 25 AND final_score < 50  THEN 1 ELSE 0 END) AS bucket_25_49,
        SUM(CASE WHEN final_score >= 50 AND final_score < 75  THEN 1 ELSE 0 END) AS bucket_50_74,
        SUM(CASE WHEN final_score >= 75 AND final_score <= 100 THEN 1 ELSE 0 END) AS bucket_75_100
      FROM user_campaigns
      WHERE campaign_id = ?
      GROUP BY campaign_id;
    `;
        const [rows] = await this.pool.execute<RowDataPacket[]>(sql, [campaign_id]);
        return rows[0] ?? null;
    }
}

const dashboardRepo = new DashboardRepo()
export default dashboardRepo