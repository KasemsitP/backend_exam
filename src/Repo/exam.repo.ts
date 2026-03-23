import { DB } from "../model/DB"; // (สมมติว่านี่คือไฟล์ DB Pool ของคุณ)
import { Pool, RowDataPacket, PoolConnection } from "mysql2/promise";
export interface ExamCampaign {
  id: number;
  code: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  note?: string;
  qr_active: number;
}

export interface CampaignSession {
  id: number;
  session_code: string;
  exam_date: string;
  campaign_id: number;
  site_id: number;
  title?: string;
  day_no?: number;
}

export interface CampaignSubject {
  session_id: number;
  subject_id: number;
  start_at: string;
  end_at: string;
  question_count: number;
  question_range?: string;
  order_no: number;
  code: string;
  name: string;
}

export interface ExamDataPayload {
  campaigns: ExamCampaign[];
  sessions: CampaignSession[];
  subjects: CampaignSubject[];
}


type FetchOpts = { includeInactive?: boolean };

class ExamDataRepo {
  private pool: Pool;
  constructor() {
    this.pool = DB.getInstance();
  }

  // /**
  //  * ดึง Campaigns ที่ยัง Active ทั้งหมด
  //  */
  // async fetchActiveCampaigns(): Promise<ExamCampaign[]> {
  //   const sql = "SELECT * FROM exam_campaigns WHERE is_active = ?";
  //   const [rows] = await this.pool.execute<RowDataPacket[]>(sql, [true]);
  //   // (เรา cast เป็น ExamCampaign[] เพราะเรารู้ว่า SELECT * ตรงกับ Interface)
  //   return rows as ExamCampaign[];
  // }

  // /**
  //  * ดึง Sessions ทั้งหมดที่อยู่ใน Campaigns ที่ Active
  //  */
  // async fetchSessionsForActiveCampaigns(): Promise<CampaignSession[]> {
  //   const sql = `
  //       SELECT s.* FROM sessions s
  //       JOIN exam_campaigns ec ON s.campaign_id = ec.id
  //       WHERE ec.is_active = ?
  //   `;
  //   const [rows] = await this.pool.execute<RowDataPacket[]>(sql, [true]);
  //   return rows as CampaignSession[];
  // }

  // /**
  //  * ดึง SessionSubjects ทั้งหมด (ที่ Join ข้อมูลวิชา)
  //  * ที่อยู่ใน Campaigns ที่ Active
  //  */
  // async fetchSubjectsForActiveCampaigns(): Promise<CampaignSubject[]> {
  //   const sql = `
  //       SELECT 
  //           ss.session_id, 
  //           ss.subject_id, 
  //           ss.start_at, 
  //           ss.end_at, 
  //           ss.question_count, 
  //           ss.question_range, 
  //           ss.order_no,
  //           s.code AS code,  -- (Join code จากตาราง subjects)
  //           s.name AS name   -- (Join name จากตาราง subjects)
  //       FROM 
  //           session_subjects ss
  //       JOIN 
  //           sessions sess ON ss.session_id = sess.id
  //       JOIN 
  //           exam_campaigns ec ON sess.campaign_id = ec.id
  //       JOIN 
  //           subjects s ON ss.subject_id = s.id
  //       WHERE 
  //           ec.is_active = ?
  //       ORDER BY 
  //           ss.session_id, ss.order_no;
  //   `;
  //   const [rows] = await this.pool.execute<RowDataPacket[]>(sql, [true]);
  //   return rows as CampaignSubject[];
  // }
  private buildActiveWhere(opts?: FetchOpts) {
    // ถ้าไม่ส่ง opts หรือระบุ includeInactive = true → ไม่กรอง is_active
    if (!opts || opts.includeInactive) return { where: "1=1", params: [] as any[] };
    // includeInactive = false → กรองเฉพาะ active
    return { where: "ec.is_active = 1", params: [] as any[] };
  }

  async fetchCampaignsNoActive(opts?: FetchOpts): Promise<ExamCampaign[]> {
    // หมายเหตุ: แนะนำให้ไม่ส่งรายการที่ถูกลบ (ถ้ามี soft delete)
    const { where, params } = this.buildActiveWhere(opts);
    const sql = `
      SELECT 
  ec.id,
  ec.code,
  ec.name,
  ec.is_active,
  ec.year_be,
  ec.site,
  ec.campaign_size,
  ec.qr_active
      FROM exam_campaigns ec
      WHERE ${where}
      ORDER BY ec.id
    `;
    const [rows] = await this.pool.execute<RowDataPacket[]>(sql, params);
    return rows as ExamCampaign[];
  }

  async fetchSessionsNoactive(opts?: FetchOpts): Promise<CampaignSession[]> {
    const { where, params } = this.buildActiveWhere(opts);
    const sql = `
      SELECT s.*
      FROM sessions s
      JOIN exam_campaigns ec ON s.campaign_id = ec.id
      WHERE ${where}
      ORDER BY s.id
    `;
    const [rows] = await this.pool.execute<RowDataPacket[]>(sql, params);
    return rows as CampaignSession[];
  }

  async fetchSubjectsNoactive(opts?: FetchOpts): Promise<CampaignSubject[]> {
    const { where, params } = this.buildActiveWhere(opts);
    const sql = `
    SELECT 
      ss.session_id,
      ss.subject_id,
      ss.start_at,
      ss.end_at,
      COALESCE(COUNT(sq.id), 0) AS question_count,   --  นับจาก subject_questions
      ss.question_range,
      ss.order_no,
      s.code AS code,
      s.name AS name
    FROM session_subjects ss
    JOIN sessions sess 
      ON ss.session_id = sess.id
    JOIN exam_campaigns ec 
      ON sess.campaign_id = ec.id
    JOIN subjects s 
      ON ss.subject_id = s.id
    LEFT JOIN subject_questions sq
      ON sq.subject_id = ss.subject_id
    WHERE ${where}
    GROUP BY
      ss.session_id,
      ss.subject_id,
      ss.start_at,
      ss.end_at,
      ss.question_range,
      ss.order_no,
      s.code,
      s.name
    ORDER BY ss.session_id, ss.order_no
  `;
    const [rows] = await this.pool.execute<RowDataPacket[]>(sql, params);
    return rows as CampaignSubject[];
  }

  async fetchCampaigns(opts?: FetchOpts): Promise<ExamCampaign[]> {
    // หมายเหตุ: แนะนำให้ไม่ส่งรายการที่ถูกลบ (ถ้ามี soft delete)
    const { where, params } = this.buildActiveWhere(opts);
    const sql = `
      SELECT ec.id, ec.code, ec.name,  ec.is_active
      FROM exam_campaigns ec
      WHERE ec.is_active = 1
      ORDER BY ec.id
    `;
    const [rows] = await this.pool.execute<RowDataPacket[]>(sql, params);
    return rows as ExamCampaign[];
  }

  async fetchSessions(opts?: FetchOpts): Promise<CampaignSession[]> {
    const { where, params } = this.buildActiveWhere(opts);
    const sql = `
      SELECT s.*
      FROM sessions s
      JOIN exam_campaigns ec ON s.campaign_id = ec.id
      WHERE ec.is_active = 1
      ORDER BY s.id
    `;
    const [rows] = await this.pool.execute<RowDataPacket[]>(sql, params);
    return rows as CampaignSession[];
  }

  async fetchSubjects(opts?: FetchOpts): Promise<CampaignSubject[]> {
    const { where, params } = this.buildActiveWhere(opts);
    const sql = `
    SELECT 
      ss.session_id,
      ss.subject_id,
      ss.start_at,
      ss.end_at,
      COALESCE(COUNT(sq.id), 0) AS question_count,   --  นับจาก subject_questions
      ss.question_range,
      ss.order_no,
      s.code AS code,
      s.name AS name
    FROM session_subjects ss
    JOIN sessions sess 
      ON ss.session_id = sess.id
    JOIN exam_campaigns ec 
      ON sess.campaign_id = ec.id
    JOIN subjects s 
      ON ss.subject_id = s.id
    LEFT JOIN subject_questions sq
      ON sq.subject_id = ss.subject_id
    WHERE ec.is_active = 1
    GROUP BY
      ss.session_id,
      ss.subject_id,
      ss.start_at,
      ss.end_at,
      ss.question_range,
      ss.order_no,
      s.code,
      s.name
    ORDER BY ss.session_id, ss.order_no
  `;
    const [rows] = await this.pool.execute<RowDataPacket[]>(sql, params);
    return rows as CampaignSubject[];
  }

  async UpdateExamActive(conn: PoolConnection, campaign_id: number) {
    const sql = `
UPDATE exam_campaigns
SET is_active = 1 where id = ?;
  `;

    await conn.execute(sql, [campaign_id]);
  }
  async UpdateExamNoActive(conn: PoolConnection, campaign_id: number) {
    const sql = `
UPDATE exam_campaigns
SET is_active = 0, qr_active = 0 where id = ? ;
  `;

    await conn.execute(sql, [campaign_id]);
  }

  async Checkactive(
    conn: PoolConnection,
    campaign_id: number
  ): Promise<number> {
    const [rows]: any = await conn.query(
      'SELECT is_active FROM exam_campaigns WHERE id = ?',
      [campaign_id]
    );

    return rows[0]?.is_active ?? 0;
  }

  async CheckQRactive(
    conn: PoolConnection,
    campaign_id: number
  ): Promise<boolean> {
    const [rows]: any = await conn.query(
      'SELECT qr_active FROM exam_campaigns WHERE id = ?',
      [campaign_id]
    );

    return rows[0]?.qr_active === 1 ;  
  }

  async CampaignLists(
    conn: PoolConnection
  ): Promise<{ id: number; is_active: number, qr_active: number }[]> {

    const [rows] = await conn.query(
      'SELECT id, is_active, qr_active FROM exam_campaigns'
    );

    return rows as { id: number; is_active: number, qr_active: number }[];
  }

  async fetchExamData(opts?: FetchOpts): Promise<ExamDataPayload> {
    const [campaigns, sessions, subjects] = await Promise.all([
      this.fetchCampaignsNoActive(opts),
      this.fetchSessionsNoactive(opts),
      this.fetchSubjectsNoactive(opts),
    ]);
    return { campaigns, sessions, subjects };
  }


  async UpdateQRNoActive(conn: PoolConnection, campaign_id: number) {
    const sql = `
UPDATE exam_campaigns
SET qr_active = 0 where id = ?;
  `;

    await conn.execute(sql, [campaign_id]);
  }
  async UpdateQRActive(conn: PoolConnection, campaign_id: number) {
    const sql = `
UPDATE exam_campaigns
SET qr_active = 1 where id = ?;
  `;

    await conn.execute(sql, [campaign_id]);
  }


}

const examDataRepo = new ExamDataRepo();
export default examDataRepo;