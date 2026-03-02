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
        select
                us.id          AS user_session_id,
                u.id           AS user_id,
                u.title        AS title,
                u.user_code    AS userCode,
                u.full_name    AS firstName,
                ''             AS lastName,
                uc.room_code   AS roomName,
                uc.row_no,
                uc.col_no
            FROM user_sessions us
            JOIN user_campaigns uc ON us.user_campaign_id = uc.id
            JOIN users u ON uc.user_id = u.id
            LEFT JOIN exam_rooms er ON er.room_code = uc.room_code AND er.campaign_id = uc.campaign_id
            WHERE us.session_id = ? AND us.campaign_id = ?
            ORDER BY uc.room_code, uc.row_no, uc.col_no;
        `;
            const [rows] = yield this.pool.execute(sql, [sessionId, campaign_id]);
            return rows;
        });
    }
    // SELECT
    /* SELECT
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
    */
    // --- 2. Fetch Paginated data (For Web Display) ---
    // --- 2. Fetch Paginated data (For Web Display) ---
    findUserSessionsWithPagination(sessionId_1, campaign_id_1, page_1, limit_1) {
        return __awaiter(this, arguments, void 0, function* (sessionId, campaign_id, page, limit, search = "") {
            const offset = (page - 1) * limit;
            // 🛑 1. ลบ LEFT JOIN exam_rooms ทิ้ง เพราะไม่ได้ใช้ประโยชน์อะไรเลย
            const baseJoins = `
            FROM user_sessions us
            JOIN user_campaigns uc ON us.user_campaign_id = uc.id
            JOIN users u ON uc.user_id = u.id
        `;
            // 🛑 2. แยกเงื่อนไข Where ออกมา
            let whereClause = `
            WHERE us.session_id = ? 
            AND us.campaign_id = ?
        `;
            // ใส่ parameters ตั้งต้นไว้ 2 ตัว
            const searchParams = [sessionId, campaign_id];
            // 🛑 3. เช็คว่ามีคำค้นหา "จริงๆ" ค่อยต่อ String Query ยัดคำสั่ง LIKE
            if (search && search.trim() !== "") {
                const searchTerm = `%${search.trim()}%`;
                whereClause += `
                AND (
                    u.user_code LIKE ? OR 
                    u.full_name LIKE ? OR
                    uc.room_code LIKE ?
                )
            `;
                // ดัน parameter เพิ่มเข้าไป 3 ตัวสำหรับ LIKE
                searchParams.push(searchTerm, searchTerm, searchTerm);
            }
            // Query 1: Count Total (ใช้ COUNT(1) จะเร็วกว่า COUNT(*) เล็กน้อยในบาง Engine)
            const countSql = `SELECT COUNT(1) as total ${baseJoins} ${whereClause}`;
            // 🛑 เปลี่ยนจาก execute เป็น query
            const [countRows] = yield this.pool.query(countSql, searchParams);
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
                uc.row_no,
                uc.col_no
            ${baseJoins}
            ${whereClause}
            ORDER BY uc.room_code, uc.row_no, uc.col_no
            LIMIT ? OFFSET ?
        `;
            // 🛑 เปลี่ยนจาก execute เป็น query และบังคับให้เป็น Number
            const [rows] = yield this.pool.query(dataSql, [
                ...searchParams,
                Number(limit), // บังคับแปลงเป็นตัวเลขเสมอ
                Number(offset) // บังคับแปลงเป็นตัวเลขเสมอ
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
