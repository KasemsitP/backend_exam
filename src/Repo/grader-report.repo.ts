// src/Repo/grader-report.repo.ts

import { PoolConnection, RowDataPacket } from "mysql2/promise";
import { DB } from "../model/DB";

// ==========================================
// 1. Exported Interfaces for Service Usage
// ==========================================

export interface BagBookletGraderCell {
  questionNo: number;
  grader1Name: string | null;
  grader2Name: string | null;
  grader1HasScore?: boolean;
  grader2HasScore?: boolean;
}

export interface BagBookletGraderBlock {
  bookletId: number;
  examCode: string;
  questions: BagBookletGraderCell[];
}

export interface BagGradersReport {
  bagId: number;
  subjectId: number;
  questionCount: number;
  questionLabels: { question_no: number; label: string }[];
  booklets: BagBookletGraderBlock[];
  info: {
    bag_no: number;
    year_be: string;
    site: string;
    campaign_size: string;
    campaign_name: string | null;
    subject_name: string;
  };
}

// ==========================================
// 2. Database Row Types (Internal/Repo)
// ==========================================

export interface AllBags extends RowDataPacket {
  bag_id: number;
  bag_no: number;
}

export type BagInfoRow = {
  bag_id: number;
  bag_no: number;
  session_id: number;
  campaign_id: number;
  year_be: string;
  site: string | null;
  campaign_size: string;
  campaign_name: string | null;
  subject_id: number;
  subject_name: string;
};

export type QuestionCountRow = { question_count: number | null };

export type QuestionLabelRow = { question_no: number; label: string };

export type BookletGraderRawRow = {
  booklet_id: number;
  exam_code: string;
  user_code: string;
  subject_id: number;
  question_no: number;

  grader1_score: number | null;
  grader2_score: number | null;

  grader1_name: string | null;
  grader2_name: string | null;
};

// ==========================================
// 3. Repository Class
// ==========================================

export class GraderReportRepo {
  
  // 1. Get info using an injected connection
  async getBagInfo(conn: PoolConnection, bagId: number, subjectId: number): Promise<BagInfoRow> {
    const sql = `
      SELECT
        bg.id AS bag_id, bg.bag_no, bg.session_id, s.campaign_id,
        ec.year_be, ec.site, ec.campaign_size, ec.name AS campaign_name,
        ss.subject_id, sub.name AS subject_name
      FROM bags bg
      JOIN sessions s ON s.id = bg.session_id
      JOIN exam_campaigns ec ON ec.id = s.campaign_id
      JOIN session_subjects ss ON ss.session_id = s.id AND ss.subject_id = ?
      JOIN subjects sub ON sub.id = ss.subject_id
      WHERE bg.id = ?
      LIMIT 1
    `;
    const [rows] = await conn.query(sql, [subjectId, bagId]);
    const r = (rows as any[])[0];
    if (!r) throw new Error("ไม่พบข้อมูลถุง/วิชา (bagId/subjectId)");
    return r as BagInfoRow;
  }

  // 2. Derive Subject ID (Critical for "All Bags" loop)
  async getDerivedSubjectIdForBag(conn: PoolConnection, bagId: number): Promise<number> {
    const sql = `
        SELECT ss.subject_id
        FROM bags bg
        JOIN sessions s ON s.id = bg.session_id
        JOIN session_subjects ss ON ss.session_id = s.id
        WHERE bg.id = ?
        ORDER BY ss.order_no ASC
    `;
    const [rows] = await conn.query<RowDataPacket[]>(sql, [bagId]);

    if (!rows?.length) throw new Error("ไม่พบ subject ของถุงนี้");
    // Default to the first subject found
    return Number(rows[0].subject_id);
  }

  // async getQuestionCountForBagSubject(conn: PoolConnection, bagId: number, subjectId: number): Promise<number> {
  //   const sql = `
  //       SELECT ss.question_count
  //       FROM bags b
  //       JOIN session_subjects ss ON ss.session_id = b.session_id
  //       WHERE b.id = ? AND ss.subject_id = ?
  //       LIMIT 1
  //   `;
  //   const [rows] = await conn.query<RowDataPacket[]>(sql, [bagId, subjectId]);
  //   return rows?.[0]?.question_count ? Number(rows[0].question_count) : 0;
  // }
 async  getQuestionCountForBagSubject(
  conn: PoolConnection,
  bagId: number,
  subjectId: number
): Promise<number | null> {
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

  const params: any[] = [bagId];
  if (subjectId) params.push(subjectId);

  const [rows] = await conn.query<RowDataPacket[]>(sql, params);
  if (!rows.length) return null;

  const qc = rows[0].question_count as number | null;
  return qc ?? null;
}

  async getQuestionLabels(conn: PoolConnection, subjectId: number): Promise<QuestionLabelRow[]> {
    const sql = `
        SELECT question_no, label
        FROM subject_questions
        WHERE subject_id = ?
        ORDER BY question_no ASC
    `;
    const [rows] = await conn.query<RowDataPacket[]>(sql, [subjectId]);
    return (rows as any[]).map((r) => ({
      question_no: Number(r.question_no),
      label: String(r.label ?? ""),
    }));
  }

  async getBookletGraderRows(conn: PoolConnection, params: { bagId: number; subjectId: number }): Promise<BookletGraderRawRow[]> {
    const { bagId, subjectId } = params;
    
    // Corrected SQL with 3 placeholders for [subjectId, subjectId, bagId]
    const sql = `
        SELECT
          b.id AS booklet_id,
          u.user_code,
          u.user_code AS exam_code,
          gs1.subject_id,
          gs1.question_no,
          sc1.score AS grader1_score,
          sc2.score AS grader2_score,
          a1.full_name AS grader1_name,
          a2.full_name AS grader2_name
        FROM booklets b
        JOIN bags bg ON bg.id = b.bag_id
        JOIN user_sessions us ON us.id = b.user_session_id
        JOIN user_campaigns uc ON uc.id = us.user_campaign_id
        JOIN users u ON u.id = uc.user_id
        
        LEFT JOIN grading_slots gs1 
          ON gs1.booklet_id = b.id 
          AND gs1.grader_order = 1 
          AND gs1.subject_id = ?  -- Param 1

        LEFT JOIN grading_slots gs2 
          ON gs2.booklet_id = b.id 
          AND gs2.grader_order = 2 
          AND gs2.subject_id = ?  -- Param 2
          AND gs2.question_no = gs1.question_no

        LEFT JOIN grading_scores sc1 ON sc1.slot_id = gs1.id
        LEFT JOIN grading_scores sc2 ON sc2.slot_id = gs2.id
        LEFT JOIN graders g1 ON g1.id = gs1.grader_id
        LEFT JOIN graders g2 ON g2.id = gs2.grader_id
        LEFT JOIN accounts a1 ON a1.id = g1.account_id
        LEFT JOIN accounts a2 ON a2.id = g2.account_id
        
        WHERE bg.id = ?           -- Param 3
        ORDER BY u.user_code ASC, gs1.question_no ASC
    `;

    const [rows] = await conn.query<any[]>(sql, [subjectId, subjectId, bagId]); 

    return (rows ?? []).map((r) => ({
      booklet_id: Number(r.booklet_id),
      user_code: String(r.user_code ?? ""),
      exam_code: String(r.exam_code ?? ""),
      subject_id: Number(r.subject_id),
      question_no: Number(r.question_no),
      grader1_score: r.grader1_score != null ? Number(r.grader1_score) : null,
      grader2_score: r.grader2_score != null ? Number(r.grader2_score) : null,
      grader1_name: r.grader1_name ? String(r.grader1_name) : null,
      grader2_name: r.grader2_name ? String(r.grader2_name) : null,
    }));
  }

  async getAllBags(conn: PoolConnection, campaignId: number): Promise<AllBags[]> {
    const sql = `
        SELECT bg.id AS bag_id, bg.bag_no
        FROM bags bg
        JOIN sessions s ON s.id = bg.session_id
        WHERE s.campaign_id = ?
        ORDER BY s.day_no ASC, bg.bag_no ASC
    `;
    const [rows] = await conn.query<AllBags[]>(sql, [campaignId]);
    return rows;
  }
}

export default new GraderReportRepo();