import { DB } from "../model/DB";
import { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from "mysql2/promise";

export interface SubjectQuestion {
  id: string;
  questionNo: number;
  label: string;
}

export interface Subject {
  id: number;
  code: string;
  name: string;
  questions: SubjectQuestion[];
}

interface Row extends RowDataPacket {
  subject_id: number;
  subject_code: string;
  subject_name: string;
  question_id: number | null;
  question_no: number | null;
  question_label: string | null;
}

interface CreateSubjectInput {
  code: string;
  name: string;
  questions?: { questionNo: number; label: string }[];
}

interface UpdateSubjectInput {
  id: number;
  code: string;
  name: string;
  questions?: { questionNo: number; label: string }[];
}

class SubjectRepo {
  private pool: Pool;

  constructor() {
    this.pool = DB.getInstance();
  }

  /* ------------------- ใช้ดึงทุกวิชาพร้อมข้อ ------------------- */

  async getSubjectsWithQuestions(): Promise<Subject[]> {
    const sql = `
      SELECT
        s.id          AS subject_id,
        s.code        AS subject_code,
        s.name        AS subject_name,
        q.id          AS question_id,
        q.question_no AS question_no,
        q.label       AS question_label
      FROM subjects s
      LEFT JOIN subject_questions q
        ON q.subject_id = s.id
      ORDER BY s.id, q.question_no;
    `;

    const [rows] = await this.pool.query<Row[]>(sql);

    const subjects: Subject[] = [];

    for (const r of rows) {
      let subject = subjects.find((s) => s.id === r.subject_id);

      if (!subject) {
        subject = {
          id: r.subject_id,
          code: r.subject_code,
          name: r.subject_name,
          questions: [],
        };
        subjects.push(subject);
      }

      if (r.question_id !== null && r.question_no !== null) {
        subject.questions.push({
          id: String(r.question_id),
          questionNo: r.question_no,
          label: r.question_label ?? "",
        });
      }
    }

    return subjects;
  }

  /* ---------- helper: ดึง 1 วิชาพร้อมข้อ ด้วย id (ใช้หลัง C/U) ---------- */

  private async getSubjectWithQuestionsById(
    conn: Pool | PoolConnection,
    id: number
  ): Promise<Subject | null> {
    const sql = `
      SELECT
        s.id          AS subject_id,
        s.code        AS subject_code,
        s.name        AS subject_name,
        q.id          AS question_id,
        q.question_no AS question_no,
        q.label       AS question_label
      FROM subjects s
      LEFT JOIN subject_questions q
        ON q.subject_id = s.id
      WHERE s.id = ?
      ORDER BY q.question_no;
    `;

    const [rows] = await conn.query<Row[]>(sql, [id]);

    if (rows.length === 0) return null;

    const first = rows[0];
    const subject: Subject = {
      id: first.subject_id,
      code: first.subject_code,
      name: first.subject_name,
      questions: [],
    };

    for (const r of rows) {
      if (r.question_id !== null && r.question_no !== null) {
        subject.questions.push({
          id: String(r.question_id),
          questionNo: r.question_no,
          label: r.question_label ?? "",
        });
      }
    }

    return subject;
  }

  /* --------------------- CREATE subject (+questions) --------------------- */

  async createSubjectWithQuestions(input: CreateSubjectInput): Promise<Subject> {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();


      const insertSubjectSql = `
        INSERT INTO subjects (code, name)
        VALUES (?, ?)
      `;
      const [subjectResult] = await conn.query<ResultSetHeader>(
        insertSubjectSql,
        [input.code, input.name]
      );
      const subjectId = subjectResult.insertId;


      const questions = input.questions ?? [];
      if (questions.length > 0) {
        const placeholders = questions.map(() => "(?, ?, ?)").join(", ");
        const params: (number | string)[] = [];

        for (const q of questions) {
          params.push(subjectId);
          params.push(q.questionNo);
          params.push(q.label);
        }

        const insertQuestionsSql = `
          INSERT INTO subject_questions (subject_id, question_no, label)
          VALUES ${placeholders}
        `;
        await conn.query(insertQuestionsSql, params);
      }

      await conn.commit();

      const subject = await this.getSubjectWithQuestionsById(conn, subjectId);
      if (!subject) {

        return {
          id: subjectId,
          code: input.code,
          name: input.name,
          questions: [],
        };
      }
      return subject;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /* --------------------- UPDATE subject (+questions) --------------------- */

  async updateSubject(input: UpdateSubjectInput): Promise<Subject | null> {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();


      const updateSql = `
        UPDATE subjects
        SET code = ?, name = ?
        WHERE id = ?
      `;
      await conn.query<ResultSetHeader>(updateSql, [
        input.code,
        input.name,
        input.id,
      ]);


      if (Array.isArray(input.questions)) {
        const deleteSql = `DELETE FROM subject_questions WHERE subject_id = ?`;
        await conn.query(deleteSql, [input.id]);

        if (input.questions.length > 0) {
          const placeholders = input.questions.map(() => "(?, ?, ?)").join(", ");
          const params: (number | string)[] = [];

          for (const q of input.questions) {
            params.push(input.id);
            params.push(q.questionNo);
            params.push(q.label);
          }

          const insertQuestionsSql = `
            INSERT INTO subject_questions (subject_id, question_no, label)
            VALUES ${placeholders}
          `;
          await conn.query(insertQuestionsSql, params);
        }
      }

      await conn.commit();

      return await this.getSubjectWithQuestionsById(conn, input.id);
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /* --------------------------- DELETE subject ---------------------------- */

  async deleteSubject(id: number): Promise<void> {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();


      const deleteQuestionsSql = `DELETE FROM subject_questions WHERE subject_id = ?`;
      await conn.query(deleteQuestionsSql, [id]);

      const deleteSubjectSql = `DELETE FROM subjects WHERE id = ?`;
      await conn.query(deleteSubjectSql, [id]);

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
  async addQuestion(
    subjectId: number,
    label: string,
    targetNo?: number
  ): Promise<Subject> {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query<RowDataPacket[]>(
        "SELECT COALESCE(MAX(question_no), 0) AS max_no FROM subject_questions WHERE subject_id = ?",
        [subjectId]
      );

      const maxNo = Number(rows[0].max_no);
      let safeNo =
        typeof targetNo === "number" && !Number.isNaN(targetNo)
          ? targetNo
          : maxNo + 1;

      if (safeNo < 1) safeNo = 1;
      if (safeNo > maxNo + 1) safeNo = maxNo + 1;


      await conn.query(
        `
        UPDATE subject_questions
        SET question_no = question_no + 1
        WHERE subject_id = ?
          AND question_no >= ?
      `,
        [subjectId, safeNo]
      );

      await conn.query(
        `
        INSERT INTO subject_questions (subject_id, question_no, label)
        VALUES (?, ?, ?)
      `,
        [subjectId, safeNo, label]
      );

      await conn.commit();

      const subject = await this.getSubjectWithQuestionsById(conn, subjectId);
      if (!subject) throw new Error("Subject not found after insert question");
      return subject;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async deleteQuestion(subjectId: number, questionId: number): Promise<Subject> {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.query(
        "DELETE FROM subject_questions WHERE id = ? AND subject_id = ?",
        [questionId, subjectId]
      );
      await conn.query("SET @no := 0");

      await conn.query(
        `
  UPDATE subject_questions
  SET question_no = (@no := @no + 1)
  WHERE subject_id = ?
  ORDER BY question_no ASC
  `,
        [subjectId]
      );

      await conn.commit();

      const subject = await this.getSubjectWithQuestionsById(conn, subjectId);
      if (!subject) throw new Error("Subject not found after delete question");
      return subject;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }


}

export const subjectRepo = new SubjectRepo();
export default subjectRepo;
