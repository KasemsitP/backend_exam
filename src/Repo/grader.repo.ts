// src/Repo/grader.repo.ts
import { DB } from "../model/DB";
import { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from "mysql2/promise";

/**
 * แถวที่ได้จาก join grading_slots + graders
 * 1 แถว = 1 slot ที่ถูก assign ให้ผู้ตรวจแล้ว
 */
export interface DbGraderAssignmentRow {
  grader_id: number;
  account_id: number;
  campaign_id: number;

  session_id: number;
  session_code: string;
  exam_date: string; // หรือ Date ถ้าคุณตั้งให้ mysql2 แปลงให้
  subject_id: number;
  subject_code: string;
  subject_name: string;
  grader_name: string
  subject_question_id: number;
  question_no: number
  question_label?: string;
  max_score : number;
}

export interface DbGrader extends RowDataPacket {
  id: number;
  campaign_id: number;
  account_id: number | null;
}
export interface GradedBagSummary extends RowDataPacket {
  bagId: number;
  bagNo: number;
  subjectId: number;
  subjectCode: string;
  subjectName: string;
  questionNo: number;
  questionLabel: string | null;
  totalScored: number;
  confirmedAt: string | null;
}

type DbClient = Pool | PoolConnection;

class GraderRepo {
  private pool: Pool;

  constructor() {
    this.pool = DB.getInstance();
  }
  async findAllAssignmentsByCampaignId(
    campaignIdNumeric: number,
    connection: PoolConnection
  ): Promise<DbGraderAssignmentRow[]> {
    const sql = `
SELECT
    ga.grader_id,
    g.account_id,
    g.campaign_id,

    ga.session_id,
    s.session_code,
    s.exam_date,

    ga.subject_id,
    subj.code  AS subject_code,
    subj.name  AS subject_name,

    ga.subject_question_id,
    sq.question_no,          -- << ดึงเลขข้อจาก subject_questions
    sq.max_score ,
    sq.label AS question_label

FROM grader_assignments ga
JOIN graders g
  ON ga.grader_id = g.id
JOIN sessions s
  ON ga.session_id = s.id
JOIN subjects subj
  ON ga.subject_id = subj.id
JOIN subject_questions sq
  ON ga.subject_question_id = sq.id
WHERE g.campaign_id = ?
ORDER BY sq.question_no ASC;
  `;

    try {
      const [rows] = await connection.execute(sql, [campaignIdNumeric]);
      return rows as DbGraderAssignmentRow[];
    } catch (error) {
      console.error("Repo Error (Grader findAllAssignmentsByCampaignId):", error);
      throw error;
    }
  }


  async findAllAssignmentsByCampaignIdByGrader(
    campaignIdNumeric: number,
    connection: PoolConnection
  ): Promise<DbGraderAssignmentRow[]> {
    const sql = `
SELECT
    ga.grader_id,
    g.account_id,
    g.campaign_id,

    ga.session_id,
    s.session_code,
    s.exam_date,

    ga.subject_id,
    subj.code  AS subject_code,
    subj.name  AS subject_name,

    ga.subject_question_id,
    sq.question_no,
    sq.label AS question_label

FROM grader_assignments ga
JOIN graders g
  ON ga.grader_id = g.id
JOIN sessions s
  ON ga.session_id = s.id
JOIN subjects subj
  ON ga.subject_id = subj.id
JOIN subject_questions sq
  ON ga.subject_question_id = sq.id
WHERE g.campaign_id = ?
  AND ga.grader_id = ?      
ORDER BY sq.question_no ASC;

  `;

    try {
      const [rows] = await connection.execute(sql, [campaignIdNumeric]);
      return rows as DbGraderAssignmentRow[];
    } catch (error) {
      console.error("ดึงข้อมูลวิชาตรวจสำหรับผู้ตรวจผิดพลาด", error);
      throw error;
    }
  }


  async findById(
    id: number,
    dbClient: DbClient = this.pool
  ): Promise<DbGrader> {
    const sql = `SELECT * FROM graders WHERE id = ? LIMIT 1`;
    const [rows] = await dbClient.execute<DbGrader[]>(sql, [id]);
    if (!rows[0]) {
      throw new Error(`Grader ${id} not found`);
    }
    return rows[0];
  }


  async getAssignmentByAccountId(campaign_id: number, account_id: number) {
    const sql = `SELECT a.id , g.id ,sq.question_no , sq.label , s.session_code , sub.name   FROM grader_assignments ga JOIN graders g ON  
    g.id = ga.grader_id JOIN accounts a ON a.id = g.account_id JOIN subject_questions sq ON sq.id = ga.subject_question_id JOIN sessions s ON ga.session_id = s.id
   	JOIN subjects sub  ON sub.id = sq.subject_id
    WHERE a.id = ? AND g.campaign_id = ?  ORDER BY sq.question_no ASC;`
    const [rows] = await this.pool.execute<RowDataPacket[]>(sql , [account_id , campaign_id])
    return rows;
  }

  async create(
    payload: {
      campaign_id: number;
      account_id: number | null;
    },
    dbClient: DbClient = this.pool
  ): Promise<DbGrader> {
    const sql = `
    INSERT INTO graders (campaign_id, account_id)
    VALUES (?, ?)
  `;
    const params = [
      payload.campaign_id,
      payload.account_id,
    ];

    const [result] = await dbClient.execute<ResultSetHeader>(sql, params);
    const newId = result.insertId;
    return this.findById(newId, dbClient);
  }


  async updateById(
    id: number,
    data: {
      name?: string;
      account_id?: number | null;
    },
    connection: PoolConnection
  ) {
    const sql = `
      UPDATE graders
      SET
        name       = COALESCE(?, name),
        account_id = COALESCE(?, account_id)
      WHERE id = ?;
    `;

    try {
      const [result] = await connection.execute(sql, [
        data.name ?? null,
        data.account_id ?? null,
        id,
      ]);
      return result;
    } catch (error) {
      console.error("Repo Error (Grader updateById):", error);
      throw error;
    }
  }

  async deleteById(id: number, connection: PoolConnection) {
    const sql = `DELETE FROM graders WHERE id = ?;`;
    try {
      const [result] = await connection.execute(sql, [id]);
      return result;
    } catch (error) {
      console.error("Repo Error (Grader deleteById):", error);
      throw error;
    }
  }
  async findByCampaignAndAccount(
    campaignId: number,
    accountId: number,
    dbClient: DbClient = this.pool
  ): Promise<DbGrader | null> {
    const sql = `
      SELECT *
      FROM graders
      WHERE campaign_id = ? AND account_id = ?
      LIMIT 1
    `;
    const [rows] = await dbClient.execute<DbGrader[]>(sql, [
      campaignId,
      accountId,
    ]);
    return rows[0] ?? null;
  }
async findConfirmedBagsByCampaignAndGrader(
  conn: PoolConnection,
  campaignId: number,
  graderId: number
): Promise<GradedBagSummary[]> {
  const sql = `
    SELECT
      b.id AS bagId,
      b.bag_no AS bagNo,
      sub.id AS subjectId,
      sub.code AS subjectCode,
      sub.name AS subjectName,
      sq.question_no AS questionNo,
      sq.label AS questionLabel,
      COUNT(DISTINCT gsc.id) AS totalScored,
      MAX(gsc.entered_at) AS confirmedAt
    FROM bags b
    JOIN sessions sess
      ON sess.id = b.session_id
    JOIN booklets bk
      ON bk.bag_id = b.id

    JOIN grader_assignments ga
      ON ga.session_id = sess.id
     AND ga.grader_id = ?

    JOIN subject_questions sq
      ON sq.id = ga.subject_question_id

    JOIN subjects sub
      ON sub.id = ga.subject_id

    LEFT JOIN grading_slots gs
      ON gs.booklet_id = bk.id
     AND gs.subject_id = ga.subject_id
     AND gs.question_no = sq.question_no
     AND gs.grader_id = ga.grader_id

    LEFT JOIN grading_scores gsc
      ON gsc.slot_id = gs.id

    WHERE sess.campaign_id = ?

    GROUP BY
      b.id,
      b.bag_no,
      sub.id,
      sub.code,
      sub.name,
      sq.question_no,
      sq.label

    HAVING COUNT(DISTINCT gsc.id) = COUNT(DISTINCT bk.id)

    ORDER BY b.bag_no, sub.code, sq.question_no
  `;

  const [rows] = await conn.query<GradedBagSummary[]>(sql, [
    graderId,
    campaignId,
  ]);

  return rows;
}
}

const graderRepo = new GraderRepo();
export default graderRepo;
