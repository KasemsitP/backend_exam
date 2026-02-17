// src/Repo/seatplan.repo.ts
import { DB } from "../model/DB";
import { Pool } from "mysql2/promise";
import { RowDataPacket } from "mysql2/promise";

export interface SeatPlanRow {
    rangeLabel: string;
    roomName: string | null;
    rowNo: number;
}

//  เพิ่ม interface ใหม่สำหรับใบรายชื่อเรียงตามชื่อ
export interface SeatPlanNameRow {
    fullName: string;
    userCode: string;
    title:string
    roomName: string | null;
    rowNo: number | null;
    colNo : number | null;
}
export interface Examinfo extends RowDataPacket {
    id: number
    name: string
    year_be: string
    site: string
    campaign_size: string
}
interface SessionDate extends RowDataPacket {
    exam_date: Date;
}

class SeatPlanRepo {
    private pool: Pool;

    constructor() {
        this.pool = DB.getInstance();
    }

    // .... ของเดิม generateSeatPlanPdf ใช้อยู่
    async findSeatPlanByCampaignAndSession(
        sessionId: number,
        campaignId: number
    ): Promise<SeatPlanRow[]> {
        const sql = `
      SELECT
        CONCAT(MIN(u.user_code), ' - ', MAX(u.user_code)) AS rangeLabel,
        uc.room_code AS roomName,
        uc.row_no    AS rowNo
      FROM user_sessions us
      JOIN user_campaigns uc ON us.user_campaign_id = uc.id
      JOIN users u ON uc.user_id = u.id
      WHERE us.session_id = ? AND us.campaign_id = ?
      GROUP BY uc.room_code, uc.row_no
      ORDER BY uc.room_code, uc.row_no;
    `;
        const [rows] = await this.pool.execute<any[]>(sql, [sessionId, campaignId]);
        return rows;
    }

    //  ใหม่: รายชื่อผู้เข้าสอบ เรียงตามชื่อ
    async findSeatPlanNameListByCampaignAndSession(
        sessionId: number,
        campaignId: number
    ): Promise<SeatPlanNameRow[]> {
        const sql = `
      SELECT
        u.full_name      AS fullName,
        u.user_code      AS userCode,
        uc.room_code     AS roomName,
        uc.row_no        AS rowNo
      FROM user_sessions us
      JOIN user_campaigns uc ON us.user_campaign_id = uc.id
      JOIN users u           ON uc.user_id = u.id
      WHERE us.session_id = ? AND us.campaign_id = ?
      ORDER BY u.full_name ASC, u.user_code ASC;
    `;
        const [rows] = await this.pool.execute<any[]>(sql, [sessionId, campaignId]);
        return rows as SeatPlanNameRow[];
    }
    async findSeatPlanNameListByCampaign(
        campaignId: number
    ): Promise<SeatPlanNameRow[]> {
        const sql = `
SELECT
        u.full_name      AS fullName,
        u.user_code      AS userCode,
        u.title          AS title,
        uc.room_code     AS roomName,
        uc.row_no        AS rowNo,
        uc.col_no        AS colNo
      FROM user_campaigns uc
      JOIN users u  ON uc.user_id = u.id
      WHERE uc.campaign_id = ?
      ORDER BY u.full_name ASC, u.user_code ASC;;
    `;
        const [rows] = await this.pool.execute<any[]>(sql, [campaignId]);
        return rows as SeatPlanNameRow[];
    }
    async getExamInfoWithSessions(
        campaign_id: number
    ): Promise<{ exam: Examinfo; dates: Date[] } | null> {

        const conn = await this.pool.getConnection();

        try {
            await conn.beginTransaction();

            // 1️⃣ exam_campaigns
            const sqlExam = `
      SELECT 
        ec.id,
        ec.name,
        ec.year_be,
        ec.site,
        ec.campaign_size
      FROM exam_campaigns ec
      WHERE ec.id = ?;
    `;

            const [examRows] = await conn.execute<Examinfo[]>(sqlExam, [campaign_id]);
            const exam = examRows[0];

            if (!exam) {
                await conn.rollback();
                return null;
            }

            // 2️⃣ sessions.exam_date
            const sqlSessions = `
      SELECT s.exam_date
      FROM sessions s
      WHERE s.campaign_id = ?;
    `;

            const [sessionRows] = await conn.execute<SessionDate[]>(sqlSessions, [campaign_id]);

            await conn.commit();

            return {
                exam,
                dates: sessionRows.map(r => r.exam_date)
            };

        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    }


}

const seatPlanRepo = new SeatPlanRepo();
export default seatPlanRepo;
