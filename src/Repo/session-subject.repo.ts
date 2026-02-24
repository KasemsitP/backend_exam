import { DB } from "../model/DB";
import { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";

export interface CreateSessionSubjectLinkPayload {
    session_id: number;
    subject_id: number;
    start_at: string;
    end_at: string;
    question_count: number;
    question_range?: string | null;
    order_no?: number | null;
}
export interface CreateSessionSubjectPayload {
    session_id: number;
    subject_id: number;
    start_at: string;
    end_at: string;
    question_count: number;
    question_range?: string;
    order_no?: number;
}

export interface ApiSessionSubject extends RowDataPacket {
    session_id: number;
    subject_id: number;
    start_at: string;
    end_at: string;
    question_count: number;
    question_range?: string;
    order_no: number;
}

export interface ApiSubjectResponse extends ApiSessionSubject {
    code: string;
    name: string;
}

export interface FindnumQuestion {
    subject_id: number,
    subject_code: number,
    total_questions: number
}
type DbClient = Pool | PoolConnection;

class SessionSubjectRepo {
    private pool: Pool;
    constructor() {
        this.pool = DB.getInstance();
    }

    /**
     * สร้างการเชื่อมโยง (Link) ในตาราง session_subjects
     * (ฟังก์ชันนี้รับ POJO ที่ Service สร้างขึ้น)
     */
    async create(
        payload: CreateSessionSubjectLinkPayload, // 👈 (รับ POJO)
        dbClient: DbClient = this.pool
    ): Promise<ApiSubjectResponse> {
        const sql = `
      INSERT INTO session_subjects 
        (session_id, subject_id, start_at, end_at, 
         question_count, question_range, order_no)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
        const params = [
            payload.session_id,
            payload.subject_id,
            payload.start_at,
            payload.end_at,
            payload.question_count,
            payload.question_range || null, // (ป้องกัน undefined)
            payload.order_no || 1, // (ป้องกัน undefined/0)
        ];

        await dbClient.execute<any>(sql, params);

        // คืนค่าข้อมูลที่ Join ตาราง subjects แล้ว
        return this.findByIds(payload.session_id, payload.subject_id, dbClient);
    }

    /**
     * ค้นหาโดยใช้ Composite Key (และ Join ตาราง subjects)
     */
    async findByIds(
        sessionId: number,
        subjectId: number,
        dbClient: DbClient = this.pool
    ): Promise<ApiSubjectResponse> {
        const sql = `
      SELECT 
        ss.*, 
        s.code, 
        s.name 
      FROM 
        session_subjects ss
      JOIN 
        subjects s ON ss.subject_id = s.id
      WHERE 
        ss.session_id = ? AND ss.subject_id = ?
    `;
        const [rows] = await dbClient.execute<ApiSubjectResponse[]>(sql, [
            sessionId,
            subjectId,
        ]);
        if (rows.length === 0) {
            throw new Error(
                `SessionSubject link (S:${sessionId}, Sub:${subjectId}) not found.`
            );
        }
        return rows[0];
    }

    /**
     * ลบโดยใช้ Composite Key (รองรับ Thunk 'deleteSubjectThunk')
     */
    async deleteByIds(
        sessionId: number,
        subjectId: number,
        dbClient: DbClient = this.pool
    ): Promise<boolean> {
        const sql =
            "DELETE FROM session_subjects WHERE session_id = ? AND subject_id = ?";
        const [result] = await dbClient.execute<any>(sql, [sessionId, subjectId]);
        return result.affectedRows > 0;
    }
    async countReferencesBySubjectId(
        subjectId: number,
        dbClient: DbClient = this.pool
    ): Promise<number> {
        const sql =
            "SELECT COUNT(*) as count FROM session_subjects WHERE subject_id = ?";
        const [rows] = await dbClient.execute<any[]>(sql, [subjectId]);
        return rows[0].count;
    }
    async findNumberofQuestion(subjectId: number): Promise<FindnumQuestion> {
        const sql = `SELECT 
    s.id AS subject_id,
    s.code AS subject_code,
    COUNT(q.id) AS total_questions
FROM subjects s
LEFT JOIN subject_questions q ON s.id = q.subject_id
WHERE s.id = ?
GROUP BY s.id, s.code, s.name`
        const [rows] = await this.pool.execute<any[]>(sql, [subjectId]);
        return rows[0]
    }

    async CheckHasSubjects(session_id: number, dbClient: DbClient = this.pool): Promise<boolean> {
        const sql = `SELECT * FROM session_subjects where session_id = ?;`
        const [rows] = await dbClient.execute<any[]>(sql, [session_id]);
        return rows.length > 0;
    }
    async CheckDubplicateSubject(session_id: number, subject_id: number, dbClient: DbClient = this.pool): Promise<boolean> {
        const sql2 = `select s.campaign_id from sessions s where id = ?;`
        const [rows2] = await dbClient.execute<any[]>(sql2, [session_id]);
        if (rows2.length === 0) {
            throw new Error(`ไม่พบ session_id: ${session_id} ในตาราง sessions`);
        }
        const campaign_id = rows2[0].campaign_id;
        const sql = `SELECT 1
FROM session_subjects ss
WHERE ss.subject_id = ?
AND ss.session_id IN (
    SELECT s.id
    FROM sessions s
    WHERE s.campaign_id = ?
)
LIMIT 1;`;
        const [rows] = await dbClient.execute<any[]>(sql, [subject_id, campaign_id]);
        return rows.length > 0;
    }
}

const sessionSubjectRepo = new SessionSubjectRepo();
export default sessionSubjectRepo;

