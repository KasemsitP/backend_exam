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
const DB_1 = require("../model/DB"); // (สมมติว่านี่คือไฟล์ DB Pool ของคุณ)
class ExamDataRepo {
    constructor() {
        this.pool = DB_1.DB.getInstance();
    }
    /**
     * ดึง Campaigns ที่ยัง Active ทั้งหมด
     */
    fetchActiveCampaigns() {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = "SELECT * FROM exam_campaigns WHERE is_active = ?";
            const [rows] = yield this.pool.execute(sql, [true]);
            // (เรา cast เป็น ExamCampaign[] เพราะเรารู้ว่า SELECT * ตรงกับ Interface)
            return rows;
        });
    }
    /**
     * ดึง Sessions ทั้งหมดที่อยู่ใน Campaigns ที่ Active
     */
    fetchSessionsForActiveCampaigns() {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
        SELECT s.* FROM sessions s
        JOIN exam_campaigns ec ON s.campaign_id = ec.id
        WHERE ec.is_active = ?
    `;
            const [rows] = yield this.pool.execute(sql, [true]);
            return rows;
        });
    }
    /**
     * ดึง SessionSubjects ทั้งหมด (ที่ Join ข้อมูลวิชา)
     * ที่อยู่ใน Campaigns ที่ Active
     */
    fetchSubjectsForActiveCampaigns() {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
        SELECT 
            ss.session_id, 
            ss.subject_id, 
            ss.start_at, 
            ss.end_at, 
            ss.question_count, 
            ss.question_range, 
            ss.order_no,
            s.code AS code,  -- (Join code จากตาราง subjects)
            s.name AS name   -- (Join name จากตาราง subjects)
        FROM 
            session_subjects ss
        JOIN 
            sessions sess ON ss.session_id = sess.id
        JOIN 
            exam_campaigns ec ON sess.campaign_id = ec.id
        JOIN 
            subjects s ON ss.subject_id = s.id
        WHERE 
            ec.is_active = ?
        ORDER BY 
            ss.session_id, ss.order_no;
    `;
            const [rows] = yield this.pool.execute(sql, [true]);
            return rows;
        });
    }
}
const examDataRepo = new ExamDataRepo();
exports.default = examDataRepo;
