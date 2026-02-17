// src/Repo/gradingReport.repo.ts
import { PoolConnection, RowDataPacket } from "mysql2/promise";
import { DB } from "../model/DB";

export interface RawQuestionAverageRow extends RowDataPacket {
  booklet_id: number;
  exam_code: string;
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

export interface CampaignSubjectRow extends RowDataPacket {
  campaign_id: number;
  name: string;
  campaign_size: string;
  year_be: string;
  site: string;
  subject_name: string;
  bag_no: number
}

export interface AllBags extends RowDataPacket {
  bag_id: number
  bag_no: number
}

export interface GraderBagSummaryRow extends RowDataPacket {
  qr_payload: string | null;
  user_code: string;      // เลขที่นั่ง (เผื่อใช้ในอนาคต)
  total_score: number;    // คะแนนรวมที่ผู้ตรวจคนนี้ให้กับเล่มนี้
}

export interface GraderInfo extends RowDataPacket {
  question_no: number
  grader_order: number
  full_name: string
}

// แต่ละแถวในตาราง "ตามเล่ม"
export interface BagScoreRowByBooklet {
  bookletId: number;
  examCode: string;
  perQuestion: Record<string, number | null>; // เช่น { "1": 5, "2": 8, ... }
  totalScore: number;
}
export interface RawBookletQuestionStatsRow extends RowDataPacket {
  booklet_id: number;
  exam_code: string;
  question_no: number;
  label: string | null;
  category: string | null;

  grader1_score: number | null;
  grader2_score: number | null;
  final_score: number | null;

  grader1_names: string | null;
  grader2_names: string | null;
}

/**
 * แปลง raw average (ต่อเล่ม-ต่อข้อ) → ตารางตามเล่ม
 */
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


//      AND ss.subject_id = ?

/**
 * ดึงคะแนนเฉลี่ยรายข้อ (หลังจากรวม 2 ผู้ตรวจแล้ว) แบบ row ธรรมดา
 */
export async function findQuestionAveragesForBagSubject(
  conn: PoolConnection,
  bagId: number,
  subjectId: number
): Promise<RawQuestionAverageRow[]> {
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
  const [rows] = await conn.query<RawQuestionAverageRow[]>(sql, [
    bagId,
  ]);
  return rows;
}

export interface RawQuestionStatsRow extends RowDataPacket {
  question_no: number;
  label: string | null;
  category: string | null;
  grader1_score: number | null;
  grader2_score: number | null;
  final_score: number | null;
  grader1_names: string | null;
  grader2_names: string | null;
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
export async function findQuestionStatsForBag(
  conn: PoolConnection,
  bagId: number,
  subjectId: number // ไม่ได้ใช้ แต่วางไว้ให้ signature เหมือน service เดิม
): Promise<RawQuestionStatsRow[]> {
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

  const [rows] = await conn.query<RawQuestionStatsRow[]>(sql, [bagId]);
  return rows;
}

export async function findBookletQuestionStatsForBag(
  conn: PoolConnection,
  bagId: number,
  subjectId: number // ยังไม่ใช้ เพราะ 1 session = 1 subject ตามที่คุณบอก
): Promise<RawBookletQuestionStatsRow[]> {
  const sql = `
    SELECT
      b.id        AS booklet_id,
      u.user_code AS exam_code,
      s.question_no,
      sq.label,
      sq.note AS category,

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
    JOIN grading_scores gs
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

  const [rows] = await conn.query<RawBookletQuestionStatsRow[]>(sql, [bagId]);
  return rows;
}

interface is_unlockType extends RowDataPacket {
  campaign_id: number
  is_unlock: number
}


export async function getUnlockCampaignByBagId(conn: PoolConnection,
  bagId: number,
): Promise<is_unlockType[]> {

  const sql = `SELECT s.campaign_id , ec.is_unlock from bags b JOIN sessions s ON s.id = b.session_id join exam_campaigns ec ON ec.id = s.campaign_id WHERE b.id = ?;`
  const [rows] = await conn.query<is_unlockType[]>(sql, [bagId])
  return rows;
}



export async function getInfomation(
  bagId: number,
): Promise<CampaignSubjectRow | null> {

  const pool = DB.getInstance()

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
  campaign_id: number
): Promise<AllBags[]> {

  const pool = DB.getInstance()

  const sql = `
SELECT b.id as bag_id, b.bag_no
        FROM bags b
        JOIN sessions s ON b.session_id = s.id
        WHERE s.campaign_id = ?
        ORDER BY s.id,b.bag_no;
  `;

  const [rows] = await pool.query<AllBags[]>(sql, [campaign_id]);

  return rows;
}

export async function getGraderBagSummary(
  conn: PoolConnection,
  bagId: number,
  graderId: number
): Promise<GraderBagSummaryRow[]> {
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

  const [rows] = await conn.query<GraderBagSummaryRow[]>(sql, [bagId, graderId]);
  return rows;
}

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

  const [rows] = await conn.query<GraderInfo[]>(sql, [bagId, graderId]);
  return rows[0] ?? null;
}







