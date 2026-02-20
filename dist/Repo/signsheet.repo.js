"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const DB_1 = require("../model/DB");
class SignSheetRepo {
    constructor() {
        this.pool = DB_1.DB.getInstance();
    }
    // --- 1. Fetch ALL data (For PDF Export) ---
    findUserSessionByCampaignAndSession(sessionId, campaign_id) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
 SELECT
                us.id          AS user_session_id,
                u.id           AS user_id,
                u.title        AS title,
                u.user_code    AS userCode,
                u.full_name    AS firstName,
                ''             AS lastName,
                uc.room_code   AS roomName,
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
            const [rows] = yield this.pool.execute(sql, [sessionId, campaign_id]);
            return rows;
        });
    }
    // --- 2. Fetch Paginated data (For Web Display) ---
    findUserSessionsWithPagination(sessionId_1, campaign_id_1, page_1, limit_1) {
        return __awaiter(this, arguments, void 0, function* (sessionId, campaign_id, page, limit, search = "") {
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
            const [countRows] = yield this.pool.execute(countSql, searchParams);
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
                us.qr_payload,
                uc.row_no
            ${baseJoins}
            ${whereClause}
            ORDER BY CAST(u.user_code AS UNSIGNED) ASC
            LIMIT ? OFFSET ?
        `;
            // Execute with limit/offset
            const [rows] = yield this.pool.execute(dataSql, [
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
        });
    }
}
const signSheetRepo = new SignSheetRepo();
exports.default = signSheetRepo;
