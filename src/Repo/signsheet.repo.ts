import { DB } from "../model/DB";
import { Pool, RowDataPacket } from "mysql2/promise";

export interface PaginatedResult<T> {
    data: T[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

class SignSheetRepo {
    private pool: Pool;

    constructor() {
        this.pool = DB.getInstance();
    }

    // --- 1. Fetch ALL data (For PDF Export) ---
    async findUserSessionByCampaignAndSession(sessionId: number, campaign_id: number): Promise<any[]> {
        const sql = `
 SELECT
                us.id          AS user_session_id,
                u.id           AS user_id,
                u.title        AS title,
                u.user_code    AS userCode,
                u.full_name    AS firstName,
                ''             AS lastName,
                uc.room_code   AS roomName,
                uc.seat_code,
                uc.row_no,
                uc.col_no,
                us.qr_payload
            FROM user_sessions us
            JOIN user_campaigns uc ON us.user_campaign_id = uc.id
            JOIN users u ON uc.user_id = u.id
            LEFT JOIN exam_rooms er ON er.room_code = uc.room_code AND er.campaign_id = uc.campaign_id
            WHERE us.session_id = ? AND us.campaign_id = ?
            ORDER BY u.user_code + 0  ASC;
        `;
        const [rows] = await this.pool.execute<any[]>(sql, [sessionId, campaign_id]);
        return rows;
    }

    // --- 2. Fetch Paginated data (For Web Display) ---
    async findUserSessionsWithPagination(
        sessionId: number,
        campaign_id: number,
        page: number,
        limit: number,
        search: string = ""
    ): Promise<PaginatedResult<any>> {
        const offset = (page - 1) * limit;
        const searchTerm = `%${search}%`;

        // Base Joins (Shared between Count and Select)
        const baseJoins = `
            FROM user_sessions us
            JOIN user_campaigns uc ON us.user_campaign_id = uc.id
            JOIN users u ON uc.user_id = u.id
            LEFT JOIN exam_rooms er ON er.room_code = uc.room_code AND er.campaign_id = uc.campaign_id
        `;

        // Base Where Clause
        const whereClause = `
            WHERE us.session_id = ? 
            AND us.campaign_id = ?
            AND (
                u.user_code LIKE ? OR 
                u.full_name LIKE ? OR
                uc.room_code LIKE ?
            )
        `;

        const searchParams = [sessionId, campaign_id, searchTerm, searchTerm, searchTerm];

        // Query 1: Count Total
        const countSql = `SELECT COUNT(*) as total ${baseJoins} ${whereClause}`;
        const [countRows] = await this.pool.execute<RowDataPacket[]>(countSql, searchParams);
        const total = countRows[0].total;

        // Query 2: Select Data
        const dataSql = `
            SELECT
                us.id          AS user_session_id,
                u.id           AS user_id,
                u.user_code    AS userCode,
                u.full_name    AS firstName,
                ''             AS lastName,
                uc.room_code   AS roomName,
                uc.seat_code,
                us.qr_payload,
                uc.row_no
            ${baseJoins}
            ${whereClause}
            ORDER BY CAST(u.user_code AS UNSIGNED) ASC
            LIMIT ? OFFSET ?
        `;

        // Execute with limit/offset
        const [rows] = await this.pool.execute<any[]>(dataSql, [
            ...searchParams,
            limit.toString(),
            offset.toString()
        ]);

        return {
            data: rows,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
}

const signSheetRepo = new SignSheetRepo();
export default signSheetRepo;