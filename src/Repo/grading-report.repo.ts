// src/Repo/gradingReport.repo.ts
import { PoolConnection, RowDataPacket } from "mysql2/promise";
import { DB } from "../model/DB";

// ==========================================
// Interfaces
// ==========================================
export interface RawQuestionAverageRow extends RowDataPacket {
  booklet_id: number;
  exam_code: string; // ใน Blind DB จะใช้ b.random_num แทน
  question_no: number;
  avg_score: number;
}

export interface RawQuestionStatsRow extends RowDataPacket {
  question_no: number;
  label: string | null;
  category: string | null;

  grader1_id: number | null;
  grader1_name: string | null;
  grader1_score: number | null;

  grader2_id: number | null;
  grader2_name: string | null;
  grader2_score: number | null;

  final_score: number | null;
}

type BagBookletQuestionRow = {
  questionNo: number;
  label?: string;

  grader1Score?: number | null;
  grader2Score?: number | null;
  finalScore?: number | null;

  grader1Name?: string | null;
  grader2Name?: string | null;
};

export interface CampaignSubjectRow extends RowDataPacket {
  campaign_id: number;
  name: string;
  campaign_size: string;
  year_be: string;
  site: string;
  subject_name: string;
  bag_no: number;
}

export interface AllBags extends RowDataPacket {
  bag_id: number;
  bag_no: number;
}

export interface GraderBagSummaryRow  {
  exam_code: string;      // เปลี่ยนจาก user_code เป็น exam_code (random_num)
  total_score: number;    // คะแนนรวมที่ผู้ตรวจคนนี้ให้กับเล่มนี้
}

export interface GraderInfo extends RowDataPacket {
  question_no: number;
  grader_order: number;
  full_name: string;
}

export interface BagScoreRowByBooklet {
  bookletId: number;
  examCode: string;
  perQuestion: Record<string, number | null>; 
  totalScore: number;
}

export interface RawBookletQuestionStatsRow extends RowDataPacket {
  booklet_id: number;
  exam_code: string; // จะใช้ b.random_num
  question_no: number;
  label: string | null;
  category: string | null;

  grader1_score: number | null;
  grader2_score: number | null;
  final_score: number | null;

  grader1_names: string | null;
  grader2_names: string | null;
}

interface is_unlockType extends RowDataPacket {
  campaign_id: number;
  is_unlock: number;
}

interface BagUnlock extends RowDataPacket {
  is_unlock: number;
}

// ==========================================
// Helper Function
// ==========================================
export function buildRowsByBooklet(
  raw: RawQuestionAverageRow[],
  questionCount: number
): BagScoreRowByBooklet[] {
  const map = new Map<number, BagScoreRowByBooklet>();

  for (const r of raw) {
    let row = map.get(r.booklet_id);
    if (!row) {
      const perQuestion: Record<string, number | null> = {};
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

export async function findQuestionCountForBagSubject(
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

export async function findQuestionLabelForBagSubject(
  conn: PoolConnection,
  bagId: number,
  subjectId: number
): Promise<{ question_no: number; label: string }[] | null> {
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

  const params: any[] = [bagId];
  if (subjectId) params.push(subjectId);

  const [rows] = await conn.query<
    (RowDataPacket & { question_no: number; label: string })[]
  >(sql, params);

  if (!rows.length) return null;

  return rows;
}

// ✅ แก้ไข: ตัด users ออก ดึงค่า b.random_num เป็น exam_code
export async function findQuestionAveragesForBagSubject(
  conn: PoolConnection,
  bagId: number,
  subjectId: number
): Promise<RawQuestionAverageRow[]> {
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
  const [rows] = await conn.query<RawQuestionAverageRow[]>(sql, [bagId]);
  
  // สร้าง exam_code ไว้หลอกๆ ก่อน Service จะเอาไปประมวลผลต่อ
  return rows.map(r => ({ ...r, exam_code: r.user_code || r.random_num }));
}

// ไม่ค่อยกระทบ เพราะดึงสรุปตามข้อ (ไม่ได้อ้างอิงรายบุคคลอยู่แล้ว)
export async function findQuestionStatsForBag(
  conn: PoolConnection,
  bagId: number,
  subjectId: number
): Promise<RawQuestionStatsRow[]> {
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

  const [rows] = await conn.query<RawQuestionStatsRow[]>(sql, [bagId]);
  return rows;
}
export async function findBookletQuestionStatsForBag(
  conn: PoolConnection,
  bagId: number,
  subjectId: number 
): Promise<RawBookletQuestionStatsRow[]> {
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

  const [rows] = await conn.query<RawBookletQuestionStatsRow[]>(sql, [bagId]);
  //console.log("RawBookletQuestionStatsRow results:", rows);
  
  return rows.map(r => ({ 
      ...r, 
      exam_code: r.user_code || r.random_num 
  }));
}

export async function getUnlockCampaignByBagId(
  conn: PoolConnection,
  bagId: number
): Promise<is_unlockType[]> {
  const sql = `
    SELECT s.campaign_id , ec.is_unlock 
    FROM bags b 
    JOIN sessions s ON s.id = b.session_id 
    JOIN exam_campaigns ec ON ec.id = s.campaign_id 
    WHERE b.id = ?;
  `;
  const [rows] = await conn.query<is_unlockType[]>(sql, [bagId]);
  return rows;
}

export async function getUnlockCampaignNoconn(
  bagId: number
): Promise<is_unlockType[]> {
  const pool = DB.getInstance();
  const sql = `
    SELECT s.campaign_id , ec.is_unlock 
    FROM bags b 
    JOIN sessions s ON s.id = b.session_id 
    JOIN exam_campaigns ec ON ec.id = s.campaign_id 
    WHERE b.id = ?;
  `;
  const [rows] = await pool.query<is_unlockType[]>(sql, [bagId]);
  return rows;
}

export async function getInfomation(
  bagId: number
): Promise<CampaignSubjectRow | null> {
  const pool = DB.getInstance();
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
  const [rows] = await pool.query<CampaignSubjectRow[]>(sql, [bagId]);
  return rows[0] ?? null;
}

export async function getAllBags(
  conn: PoolConnection,
  campaign_id: number
): Promise<AllBags[]> {
  const sql = `
    SELECT b.id as bag_id, b.bag_no
    FROM bags b
    JOIN sessions s ON b.session_id = s.id
    WHERE s.campaign_id = ?
    ORDER BY s.day_no, b.bag_no;
  `;
  const [rows] = await conn.query<AllBags[]>(sql, [campaign_id]);
  return rows;
}

export async function getCampaignUnlock(
  conn: PoolConnection,
  campaign_id: number
): Promise<number> {
  const sql = `
    SELECT is_unlock 
    FROM exam_campaigns 
    WHERE id = ?
  `;
  const [rows] = await conn.query<BagUnlock[]>(sql, [campaign_id]);
  return rows[0]?.is_unlock ?? 0;
}

export async function getGraderBagSummary(
  conn: PoolConnection,
  bagId: number,
  graderId: number
): Promise<GraderBagSummaryRow[]> {
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

  const [rows] = await conn.query<any[]>(sql, [bagId, graderId]);
  
  // แปลงให้ตรงกับ Type เดิม
  return rows.map(r => ({ 
      exam_code: r.user_code || r.random_num, 
      total_score: r.total_score 
  }));
}
// ✅ แก้ไข: ตัด users ออก เปลี่ยนการจัดเรียงมาอิง random_num แทน
export async function getGraderInfo(
  conn: PoolConnection,
  bagId: number,
  graderId: number
): Promise<GraderInfo | null> {
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

  const [rows] = await conn.query<GraderInfo[]>(sql, [bagId, graderId]);
  return rows[0] ?? null;
}