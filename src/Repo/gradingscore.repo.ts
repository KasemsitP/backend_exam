// src/Repo/gradingscore.repo.ts
import { DB } from "../model/DB";
import { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from "mysql2/promise";

export interface DbGradingScoreRow extends RowDataPacket {
  gradingscoreId: number;
  slotId: number;
  score: number;
  status: string;
  enteredAt: Date;
  graderId: number;
  graderName: string;
}
export interface DisputedSlotRow extends RowDataPacket {
  slotId: number;
  bookletId: number;
  subjectId: number;
  questionNo: number;
  graderId: number;
  graderOrder: number;
  score: number;
  enteredAt: Date;
  graderName: string;
  subjectCode: string;
  subjectName: string;
}
export interface DisputedQuestionRow extends RowDataPacket {
  bookletId: number;
  subjectId: number;
  questionNo: number;

  bagId: number | null;
  bagNo: number | null;

  subjectCode: string;
  subjectName: string;
  questionLabel: string | null;

  slotId1: number;
  slotId2: number;
  score1: number;
  score2: number;
  diff: number;

  graderId1: number;
  graderId2: number;
  graderName1: string;
  graderName2: string;
}


export interface GradingRecordAll extends RowDataPacket {
  score: number;
  slotId: number;
  enteredAT: Date;
  qr_payload: string
}

export interface SlotContextRow {
  slotId: number;
  bookletId: number;
  subjectId: number;
  questionNo: number;
}

export interface ScoreForSlotGroupRow extends RowDataPacket {
  id: number;
  slotId: number;
  score: number;
  enteredBy: number;
  enteredAt: Date;
}
interface CheckScoreRow extends RowDataPacket {
  question_no: number;
  label: string;
  max_score: number;
}

class GradingScoreRepo {
  private pool: Pool;

  constructor() {
    // ถ้าใน DB class มี getPool() ก็ใช้แบบนี้
    // this.pool = DB.getInstance().getPool();
    // ถ้าของเดิมคุณใช้ DB.getInstance() เป็น pool อยู่แล้วก็ใช้แบบเดิมได้
    // @ts-ignore ปล่อยให้ตรงกับ implementation เดิมของคุณ
    this.pool = DB.getInstance() as unknown as Pool;
  }

  async verifySlotContext(
    conn: PoolConnection,
    params: {
      slotId: number;
      campaignId: number;
      graderId: number;
    }
  ): Promise<boolean> {
    const { slotId, campaignId, graderId } = params;

    const sql = `
      SELECT
        s.id AS slot_id
      FROM grading_slots s
      JOIN booklets b
        ON s.booklet_id = b.id
      JOIN user_sessions us
        ON b.user_session_id = us.id
      WHERE s.id = ?
        AND us.campaign_id = ?
        AND s.grader_id = ?
      LIMIT 1;
    `;

    const paramsArr = [slotId, campaignId, graderId];

    const [rows] = await conn.execute<RowDataPacket[]>(sql, paramsArr);
    return rows.length > 0;
  }

  async CheckScore(
    conn: PoolConnection,
    params: {
      slotId: number;
      question_no: number;
      graderId: number;
    }
  ): Promise<CheckScoreRow | null> {
    const { slotId, question_no, graderId } = params;

    const sql = `
SELECT sq.question_no , sq.label , sq.max_score from subject_questions sq JOIN subjects s ON s.id = sq.subject_id JOIN grading_slots gs ON gs.subject_id = s.id WHERE gs.id = ? AND sq.question_no = ? AND gs.grader_id = ?;
    `;

    const paramsArr = [slotId, question_no, graderId];

   const [rows] = await conn.execute<CheckScoreRow[]>(sql, paramsArr);
    return rows[0] || null;
  }

  /**
   * INSERT ลง grading_scores
   * คืน id ที่พึ่ง insert มา
   */
  async insertScore(
    conn: PoolConnection,
    slotId: number,
    score: number,
    graderId: number
  ): Promise<number> {
    const sql = `
      INSERT INTO grading_scores (slot_id, score, entered_by)
      VALUES (?, ?, ?)
    `;
    const [result] = await conn.execute<ResultSetHeader>(sql, [
      slotId,
      score,
      graderId,
    ]);

    return result.insertId;
  }

  /**
   * อัปเดตสถานะของ slot (เช่น COMPLETED / DISPUTED ฯลฯ)
   */
  async updateSlotStatus(
    conn: PoolConnection,
    slotId: number,
    status: string
  ): Promise<void> {
    const sql = `
      UPDATE grading_slots
      SET status = ?
      WHERE id = ?
    `;
    await conn.execute(sql, [status, slotId]);
  }

  /**
   * ดึงข้อมูลคะแนนที่เพิ่งบันทึก พร้อม join ไปเอาชื่อ grader และ status ของ slot
   */
  async findScoreById(
    conn: PoolConnection,
    gradingScoreId: number
  ): Promise<DbGradingScoreRow | null> {
    const sql = `
      SELECT
        gs.id         AS gradingscoreId,
        gs.slot_id    AS slotId,
        gs.score      AS score,
        s.status      AS status,
        gs.entered_at AS enteredAt,
        g.id          AS graderId,
        COALESCE(a.full_name, CONCAT('Grader #', g.id)) AS graderName
      FROM grading_scores gs
      JOIN grading_slots s
        ON gs.slot_id = s.id
      JOIN graders g
        ON gs.entered_by = g.id
      LEFT JOIN accounts a
        ON g.account_id = a.id
      WHERE gs.id = ?
      LIMIT 1;
    `;

    const [rows] = await conn.execute<DbGradingScoreRow[]>(sql, [gradingScoreId]);
    return rows[0] || null;
  }

  async FindAllRecord(
    grader_id: number
  ): Promise<GradingRecordAll[] | null> {
    const sql = `
SELECT 
  g.slot_id,
  g.score,
  g.entered_at AS enteredAT,
  us.qr_payload
FROM grading_scores g
JOIN grading_slots gs 
  ON gs.id = g.slot_id
JOIN booklets b 
  ON b.id = gs.booklet_id
JOIN user_sessions us 
  ON us.id = b.user_session_id
WHERE g.entered_by = ?
ORDER BY g.entered_at DESC
LIMIT 25 OFFSET 0;
    `;
    const [rows] = await this.pool.execute<GradingRecordAll[]>(sql, [grader_id]);
    return rows.length ? rows : null;
  }

  /**
   * ใช้ตอน recheck:
   * จาก slotId → หา context ว่าเป็นเล่มไหน / วิชาไหน / ข้อที่เท่าไหร่
   */
  async findSlotContextById(
    conn: PoolConnection,
    slotId: number
  ): Promise<SlotContextRow | null> {
    const sql = `
      SELECT 
        gs.id          AS slotId,
        gs.booklet_id  AS bookletId,
        gs.subject_id  AS subjectId,
        gs.question_no AS questionNo
      FROM grading_slots gs
      WHERE gs.id = ?
      LIMIT 1
    `;
    const [rows] = await conn.query<RowDataPacket[]>(sql, [slotId]);

    if (!rows.length) return null;

    return {
      slotId: Number(rows[0].slotId),
      bookletId: Number(rows[0].bookletId),
      subjectId: Number(rows[0].subjectId),
      questionNo: Number(rows[0].questionNo),
    };
  }

  /**
   * ดึงคะแนนทั้งหมดของ "กลุ่มเดียวกัน" = เล่มเดียวกัน + วิชาเดียวกัน + ข้อเดียวกัน
   * ใช้ใน checkAndMarkDisputedIfNeeded เพื่อตรวจว่าคะแนน 2 คนต่างกันเกิน threshold มั้ย
   */
  async findScoresForSlotGroup(
    conn: PoolConnection,
    bookletId: number,
    subjectId: number,
    questionNo: number
  ): Promise<ScoreForSlotGroupRow[]> {
    const sql = `
      SELECT
        gs.id         AS id,
        gs.slot_id    AS slotId,
        gs.score      AS score,
        gs.entered_by AS enteredBy,
        gs.entered_at AS enteredAt
      FROM grading_scores gs
      JOIN grading_slots sl
        ON gs.slot_id = sl.id
      WHERE sl.booklet_id = ?
        AND sl.subject_id = ?
        AND sl.question_no = ?
      ORDER BY gs.entered_at ASC
    `;

    const [rows] = await conn.query<ScoreForSlotGroupRow[]>(sql, [
      bookletId,
      subjectId,
      questionNo,
    ]);

    return rows;
  }

  /**
   * ลบคะแนนเดิมของ "ข้อเดียวกันในเล่มเดียวกัน" สำหรับผู้ตรวจทุกคน
   * ใช้ตอน reset เพื่อ recheck ใหม่
   */
  async deleteScoresForQuestion(
    conn: PoolConnection,
    bookletId: number,
    subjectId: number,
    questionNo: number
  ): Promise<void> {
    const sql = `
      DELETE gs
      FROM grading_scores gs
      JOIN grading_slots sl
        ON gs.slot_id = sl.id
      WHERE sl.booklet_id = ?
        AND sl.subject_id = ?
        AND sl.question_no = ?
    `;
    await conn.query<ResultSetHeader>(sql, [bookletId, subjectId, questionNo]);
  }

  /**
   * เซ็ต status ของ slot ทั้งหมดของเล่ม+วิชา+ข้อนี้กลับเป็น 'OPEN'
   * (แล้วแต่ design คุณ ถ้าอยากใช้ 'DISPUTED' หรือ flag อื่นก็เปลี่ยนได้)
   */
  async resetSlotsStatusForQuestion(
    conn: PoolConnection,
    bookletId: number,
    subjectId: number,
    questionNo: number
  ): Promise<void> {
    const sql = `
      UPDATE grading_slots
      SET status = 'OPEN',
          grader_id = grader_id  -- ไม่แตะ grader_id แค่เปลี่ยนสถานะ
      WHERE booklet_id = ?
        AND subject_id = ?
        AND question_no = ?
    `;
    await conn.query<ResultSetHeader>(sql, [bookletId, subjectId, questionNo]);
  }
  async findDisputedByBooklet(
    conn: PoolConnection,
    bookletId: number
  ): Promise<DisputedSlotRow[]> {
    const sql = `
      SELECT
        sl.id           AS slotId,
        sl.booklet_id   AS bookletId,
        sl.subject_id   AS subjectId,
        sl.question_no  AS questionNo,
        sl.grader_id    AS graderId,
        sl.grader_order AS graderOrder,
        gs.score        AS score,
        gs.entered_at   AS enteredAt,
        COALESCE(a.full_name, CONCAT('Grader #', g.id)) AS graderName,
        sub.code        AS subjectCode,
        sub.name        AS subjectName
      FROM grading_slots sl
      JOIN grading_scores gs
        ON gs.slot_id = sl.id
      JOIN graders g
        ON sl.grader_id = g.id
      LEFT JOIN accounts a
        ON g.account_id = a.id
      JOIN subjects sub
        ON sl.subject_id = sub.id
      WHERE sl.booklet_id = ?
        AND sl.status = 'DISPUTED'
      ORDER BY sl.subject_id, sl.question_no, sl.grader_order
    `;

    const [rows] = await conn.query<DisputedSlotRow[]>(sql, [bookletId]);
    return rows;
  }
  async findDisputedQuestions(
    conn: Pool | PoolConnection = this.pool,
    campaign_id: number,
    thresholdDiff: number
  ): Promise<DisputedQuestionRow[]> {
    const sql = `
SELECT
  t.booklet_id       AS bookletId,
  t.bag_no           AS bagNo,
  t.subject_id       AS subjectId,
  t.subjectCode,
  t.subjectName,
  t.question_no      AS questionNo,
  t.questionLabel,

  MIN(t.minScore) AS minScore,
  MAX(t.maxScore) AS maxScore,
  MAX(t.maxScore - t.minScore) AS diff,

  MAX(CASE WHEN t.rnAsc = 1 THEN t.slot_id    END) AS slotId1,
  MAX(CASE WHEN t.rnAsc = 1 THEN t.score      END) AS score1,
  MAX(CASE WHEN t.rnAsc = 1 THEN t.grader_id  END) AS graderId1,
  MAX(CASE WHEN t.rnAsc = 1 THEN t.graderName END) AS graderName1,

  MAX(CASE WHEN t.rnDesc = 1 THEN t.slot_id    END) AS slotId2,
  MAX(CASE WHEN t.rnDesc = 1 THEN t.score      END) AS score2,
  MAX(CASE WHEN t.rnDesc = 1 THEN t.grader_id  END) AS graderId2,
  MAX(CASE WHEN t.rnDesc = 1 THEN t.graderName END) AS graderName2

FROM (
  SELECT
    sl.booklet_id,
    bg.bag_no,
    sl.subject_id,
    subj.code AS subjectCode,
    subj.name AS subjectName,
    sl.question_no,
    sq.label  AS questionLabel,

    sl.id     AS slot_id,
    gs.score,
    gs.entered_by AS grader_id,
    COALESCE(acc.full_name, CONCAT('Grader #', gr.id)) AS graderName,

    ROW_NUMBER() OVER (
      PARTITION BY sl.booklet_id, sl.subject_id, sl.question_no
      ORDER BY gs.score ASC
    ) AS rnAsc,

    ROW_NUMBER() OVER (
      PARTITION BY sl.booklet_id, sl.subject_id, sl.question_no
      ORDER BY gs.score DESC
    ) AS rnDesc,

    MIN(gs.score) OVER (
      PARTITION BY sl.booklet_id, sl.subject_id, sl.question_no
    ) AS minScore,

    MAX(gs.score) OVER (
      PARTITION BY sl.booklet_id, sl.subject_id, sl.question_no
    ) AS maxScore

  FROM grading_slots sl
  JOIN grading_scores gs
    ON gs.slot_id = sl.id
  JOIN booklets bk
    ON bk.id = sl.booklet_id
  JOIN user_sessions us
    ON bk.user_session_id = us.id
  LEFT JOIN bags bg
    ON bk.bag_id = bg.id
  JOIN subjects subj
    ON subj.id = sl.subject_id
  LEFT JOIN subject_questions sq
    ON sq.subject_id = sl.subject_id
   AND sq.question_no = sl.question_no
  JOIN graders gr
    ON gs.entered_by = gr.id
  LEFT JOIN accounts acc
    ON gr.account_id = acc.id
  WHERE us.campaign_id = ?
) t
JOIN (
  SELECT
    sl.booklet_id,
    sl.subject_id,
    sl.question_no,
    COUNT(DISTINCT gs.entered_by) AS gradersCount
  FROM grading_slots sl
  JOIN grading_scores gs
    ON gs.slot_id = sl.id
  GROUP BY
    sl.booklet_id,
    sl.subject_id,
    sl.question_no
) gc
  ON gc.booklet_id = t.booklet_id
 AND gc.subject_id = t.subject_id
 AND gc.question_no = t.question_no

WHERE
  gc.gradersCount >= 2
  AND (t.maxScore - t.minScore) >= ?

GROUP BY
  t.booklet_id,
  t.bag_no,
  t.subject_id,
  t.subjectCode,
  t.subjectName,
  t.question_no,
  t.questionLabel

ORDER BY diff DESC;
    `;

    const [rows] = await conn.query<DisputedQuestionRow[]>(sql, [campaign_id, thresholdDiff]);
    return rows;
  }


  async findDisputedQuestionsForDashboard(
    campaign_id: number,
    thresholdDiff: number
  ): Promise<number> {
    const sql = `
SELECT
  t.booklet_id       AS bookletId,
  t.bag_no           AS bagNo,
  t.subject_id       AS subjectId,
  t.subjectCode,
  t.subjectName,
  t.question_no      AS questionNo,
  t.questionLabel,

  MIN(t.minScore) AS minScore,
  MAX(t.maxScore) AS maxScore,
  MAX(t.maxScore - t.minScore) AS diff,

  MAX(CASE WHEN t.rnAsc = 1 THEN t.slot_id    END) AS slotId1,
  MAX(CASE WHEN t.rnAsc = 1 THEN t.score      END) AS score1,
  MAX(CASE WHEN t.rnAsc = 1 THEN t.grader_id  END) AS graderId1,
  MAX(CASE WHEN t.rnAsc = 1 THEN t.graderName END) AS graderName1,

  MAX(CASE WHEN t.rnDesc = 1 THEN t.slot_id    END) AS slotId2,
  MAX(CASE WHEN t.rnDesc = 1 THEN t.score      END) AS score2,
  MAX(CASE WHEN t.rnDesc = 1 THEN t.grader_id  END) AS graderId2,
  MAX(CASE WHEN t.rnDesc = 1 THEN t.graderName END) AS graderName2

FROM (
  SELECT
    sl.booklet_id,
    bg.bag_no,
    sl.subject_id,
    subj.code AS subjectCode,
    subj.name AS subjectName,
    sl.question_no,
    sq.label  AS questionLabel,

    sl.id     AS slot_id,
    gs.score,
    gs.entered_by AS grader_id,
    COALESCE(acc.full_name, CONCAT('Grader #', gr.id)) AS graderName,

    ROW_NUMBER() OVER (
      PARTITION BY sl.booklet_id, sl.subject_id, sl.question_no
      ORDER BY gs.score ASC
    ) AS rnAsc,

    ROW_NUMBER() OVER (
      PARTITION BY sl.booklet_id, sl.subject_id, sl.question_no
      ORDER BY gs.score DESC
    ) AS rnDesc,

    MIN(gs.score) OVER (
      PARTITION BY sl.booklet_id, sl.subject_id, sl.question_no
    ) AS minScore,

    MAX(gs.score) OVER (
      PARTITION BY sl.booklet_id, sl.subject_id, sl.question_no
    ) AS maxScore

  FROM grading_slots sl
  JOIN grading_scores gs
    ON gs.slot_id = sl.id
  JOIN booklets bk
    ON bk.id = sl.booklet_id
  JOIN user_sessions us
    ON bk.user_session_id = us.id
  LEFT JOIN bags bg
    ON bk.bag_id = bg.id
  JOIN subjects subj
    ON subj.id = sl.subject_id
  LEFT JOIN subject_questions sq
    ON sq.subject_id = sl.subject_id
   AND sq.question_no = sl.question_no
  JOIN graders gr
    ON gs.entered_by = gr.id
  LEFT JOIN accounts acc
    ON gr.account_id = acc.id
  WHERE us.campaign_id = ?
) t
JOIN (
  SELECT
    sl.booklet_id,
    sl.subject_id,
    sl.question_no,
    COUNT(DISTINCT gs.entered_by) AS gradersCount
  FROM grading_slots sl
  JOIN grading_scores gs
    ON gs.slot_id = sl.id
  GROUP BY
    sl.booklet_id,
    sl.subject_id,
    sl.question_no
) gc
  ON gc.booklet_id = t.booklet_id
 AND gc.subject_id = t.subject_id
 AND gc.question_no = t.question_no

WHERE
  gc.gradersCount >= 2
  AND (t.maxScore - t.minScore) >= ?

GROUP BY
  t.booklet_id,
  t.bag_no,
  t.subject_id,
  t.subjectCode,
  t.subjectName,
  t.question_no,
  t.questionLabel

ORDER BY diff DESC;
    `;

    const [rows] = await this.pool.query<DisputedQuestionRow[]>(sql, [campaign_id, thresholdDiff]);
    return rows ? rows.length : 0;
  }
}

const gradingscoreRepo = new GradingScoreRepo();
export default gradingscoreRepo;
