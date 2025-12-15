// src/Repo/grader-assignment.repo.ts
import { DB } from "../model/DB";
import { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";

export interface DbGraderAssignment extends RowDataPacket {
  id: number;
  grader_id: number;
  session_id: number;
  subject_id: number;
  subject_question_id: number;
}

type DbClient = Pool | PoolConnection;

class GraderAssignmentRepo {
  private pool: Pool;

  constructor() {
    this.pool = DB.getInstance();
  }

  async insertOne(
    payload: {
      grader_id: number;
      session_id: number;
      subject_id: number;
      subject_question_id: number;
    },
    dbClient: DbClient = this.pool
  ): Promise<void> {
    console.log("assign Repo",payload)
    const sql = `
      INSERT INTO grader_assignments
        (grader_id, session_id, subject_id, subject_question_id)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        grader_id = grader_id
    `;
    const params = [
      payload.grader_id,
      payload.session_id,
      payload.subject_id,
      payload.subject_question_id,
    ];
    await dbClient.execute(sql, params);
  }
}

const graderAssignmentRepo = new GraderAssignmentRepo();
export default graderAssignmentRepo;
