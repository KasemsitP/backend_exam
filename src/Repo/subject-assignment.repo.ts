// src/Repo/subject-question.repo.ts
import { DB } from "../model/DB";
import { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";

export interface CreateGraderAssignmentInput {
  campaignId: number;
  accountId: number;   
  sessionId: number;   
  subjectId: number;   
  questionNo: number;  
}

export interface DbSubjectQuestion extends RowDataPacket {
  id: number;
  subject_id: number;
  question_no: number;
  label: string;
}

type DbClient = Pool | PoolConnection;

class SubjectQuestionRepo {
  private pool: Pool;

  constructor() {
    this.pool = DB.getInstance();
  }

  async findBySubjectAndNo(
    subjectId: number,
    questionNo: number,
    dbClient: DbClient = this.pool
  ): Promise<DbSubjectQuestion | null> {
    const sql = `
      SELECT id, subject_id, question_no, label
      FROM subject_questions
      WHERE subject_id = ? AND question_no = ?
      LIMIT 1
    `;
    const [rows] = await dbClient.execute<DbSubjectQuestion[]>(sql, [
      subjectId,
      questionNo,
    ]);
    return rows[0] ?? null;
  }
}

const subjectQuestionRepo = new SubjectQuestionRepo();
export default subjectQuestionRepo;
