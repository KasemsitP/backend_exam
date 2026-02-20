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
    // /**
    //  * ดึง Campaigns ที่ยัง Active ทั้งหมด
    //  */
    // async fetchActiveCampaigns(): Promise<ExamCampaign[]> {
    //   const sql = "SELECT * FROM exam_campaigns WHERE is_active = ?";
    //   const [rows] = await this.pool.execute<RowDataPacket[]>(sql, [true]);
    //   // (เรา cast เป็น ExamCampaign[] เพราะเรารู้ว่า SELECT * ตรงกับ Interface)
    //   return rows as ExamCampaign[];
    // }
    // /**
    //  * ดึง Sessions ทั้งหมดที่อยู่ใน Campaigns ที่ Active
    //  */
    // async fetchSessionsForActiveCampaigns(): Promise<CampaignSession[]> {
    //   const sql = `
    //       SELECT s.* FROM sessions s
    //       JOIN exam_campaigns ec ON s.campaign_id = ec.id
    //       WHERE ec.is_active = ?
    //   `;
    //   const [rows] = await this.pool.execute<RowDataPacket[]>(sql, [true]);
    //   return rows as CampaignSession[];
    // }
    // /**
    //  * ดึง SessionSubjects ทั้งหมด (ที่ Join ข้อมูลวิชา)
    //  * ที่อยู่ใน Campaigns ที่ Active
    //  */
    // async fetchSubjectsForActiveCampaigns(): Promise<CampaignSubject[]> {
    //   const sql = `
    //       SELECT 
    //           ss.session_id, 
    //           ss.subject_id, 
    //           ss.start_at, 
    //           ss.end_at, 
    //           ss.question_count, 
    //           ss.question_range, 
    //           ss.order_no,
    //           s.code AS code,  -- (Join code จากตาราง subjects)
    //           s.name AS name   -- (Join name จากตาราง subjects)
    //       FROM 
    //           session_subjects ss
    //       JOIN 
    //           sessions sess ON ss.session_id = sess.id
    //       JOIN 
    //           exam_campaigns ec ON sess.campaign_id = ec.id
    //       JOIN 
    //           subjects s ON ss.subject_id = s.id
    //       WHERE 
    //           ec.is_active = ?
    //       ORDER BY 
    //           ss.session_id, ss.order_no;
    //   `;
    //   const [rows] = await this.pool.execute<RowDataPacket[]>(sql, [true]);
    //   return rows as CampaignSubject[];
    // }
    buildActiveWhere(opts) {
        // ถ้าไม่ส่ง opts หรือระบุ includeInactive = true → ไม่กรอง is_active
        if (!opts || opts.includeInactive)
            return { where: "1=1", params: [] };
        // includeInactive = false → กรองเฉพาะ active
        return { where: "ec.is_active = 1", params: [] };
    }
    fetchCampaignsNoActive(opts) {
        return __awaiter(this, void 0, void 0, function* () {
            // หมายเหตุ: แนะนำให้ไม่ส่งรายการที่ถูกลบ (ถ้ามี soft delete)
            const { where, params } = this.buildActiveWhere(opts);
            const sql = `
      SELECT 
  ec.id,
  ec.code,
  ec.name,
  ec.is_active,
  ec.year_be,
  ec.site,
  ec.campaign_size,
  ec.qr_active
      FROM exam_campaigns ec
      WHERE ${where}
      ORDER BY ec.id
    `;
            const [rows] = yield this.pool.execute(sql, params);
            return rows;
        });
    }
    fetchSessionsNoactive(opts) {
        return __awaiter(this, void 0, void 0, function* () {
            const { where, params } = this.buildActiveWhere(opts);
            const sql = `
      SELECT s.*
      FROM sessions s
      JOIN exam_campaigns ec ON s.campaign_id = ec.id
      WHERE ${where}
      ORDER BY s.id
    `;
            const [rows] = yield this.pool.execute(sql, params);
            return rows;
        });
    }
    fetchSubjectsNoactive(opts) {
        return __awaiter(this, void 0, void 0, function* () {
            const { where, params } = this.buildActiveWhere(opts);
            const sql = `
    SELECT 
      ss.session_id,
      ss.subject_id,
      ss.start_at,
      ss.end_at,
      COALESCE(COUNT(sq.id), 0) AS question_count,   --  นับจาก subject_questions
      ss.question_range,
      ss.order_no,
      s.code AS code,
      s.name AS name
    FROM session_subjects ss
    JOIN sessions sess 
      ON ss.session_id = sess.id
    JOIN exam_campaigns ec 
      ON sess.campaign_id = ec.id
    JOIN subjects s 
      ON ss.subject_id = s.id
    LEFT JOIN subject_questions sq
      ON sq.subject_id = ss.subject_id
    WHERE ${where}
    GROUP BY
      ss.session_id,
      ss.subject_id,
      ss.start_at,
      ss.end_at,
      ss.question_range,
      ss.order_no,
      s.code,
      s.name
    ORDER BY ss.session_id, ss.order_no
  `;
            const [rows] = yield this.pool.execute(sql, params);
            return rows;
        });
    }
    fetchCampaigns(opts) {
        return __awaiter(this, void 0, void 0, function* () {
            // หมายเหตุ: แนะนำให้ไม่ส่งรายการที่ถูกลบ (ถ้ามี soft delete)
            const { where, params } = this.buildActiveWhere(opts);
            const sql = `
      SELECT ec.id, ec.code, ec.name,  ec.is_active
      FROM exam_campaigns ec
      WHERE ec.is_active = 1
      ORDER BY ec.id
    `;
            const [rows] = yield this.pool.execute(sql, params);
            return rows;
        });
    }
    fetchSessions(opts) {
        return __awaiter(this, void 0, void 0, function* () {
            const { where, params } = this.buildActiveWhere(opts);
            const sql = `
      SELECT s.*
      FROM sessions s
      JOIN exam_campaigns ec ON s.campaign_id = ec.id
      WHERE ec.is_active = 1
      ORDER BY s.id
    `;
            const [rows] = yield this.pool.execute(sql, params);
            return rows;
        });
    }
    fetchSubjects(opts) {
        return __awaiter(this, void 0, void 0, function* () {
            const { where, params } = this.buildActiveWhere(opts);
            const sql = `
    SELECT 
      ss.session_id,
      ss.subject_id,
      ss.start_at,
      ss.end_at,
      COALESCE(COUNT(sq.id), 0) AS question_count,   --  นับจาก subject_questions
      ss.question_range,
      ss.order_no,
      s.code AS code,
      s.name AS name
    FROM session_subjects ss
    JOIN sessions sess 
      ON ss.session_id = sess.id
    JOIN exam_campaigns ec 
      ON sess.campaign_id = ec.id
    JOIN subjects s 
      ON ss.subject_id = s.id
    LEFT JOIN subject_questions sq
      ON sq.subject_id = ss.subject_id
    WHERE ec.is_active = 1
    GROUP BY
      ss.session_id,
      ss.subject_id,
      ss.start_at,
      ss.end_at,
      ss.question_range,
      ss.order_no,
      s.code,
      s.name
    ORDER BY ss.session_id, ss.order_no
  `;
            const [rows] = yield this.pool.execute(sql, params);
            return rows;
        });
    }
    UpdateExamActive(conn, campaign_id) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
UPDATE exam_campaigns
SET is_active = 1 where id = ?;
  `;
            yield conn.execute(sql, [campaign_id]);
        });
    }
    UpdateExamNoActive(conn, campaign_id) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
UPDATE exam_campaigns
SET is_active = 0 where id = ?;
  `;
            yield conn.execute(sql, [campaign_id]);
        });
    }
    Checkactive(conn, campaign_id) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const [rows] = yield conn.query('SELECT is_active FROM exam_campaigns WHERE id = ?', [campaign_id]);
            return (_b = (_a = rows[0]) === null || _a === void 0 ? void 0 : _a.is_active) !== null && _b !== void 0 ? _b : 0;
        });
    }
    CheckQRactive(conn, campaign_id) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const [rows] = yield conn.query('SELECT qr_active FROM exam_campaigns WHERE id = ?', [campaign_id]);
            return ((_a = rows[0]) === null || _a === void 0 ? void 0 : _a.qr_active) === 1;
        });
    }
    CampaignLists(conn) {
        return __awaiter(this, void 0, void 0, function* () {
            const [rows] = yield conn.query('SELECT id, is_active, qr_active FROM exam_campaigns');
            return rows;
        });
    }
    fetchExamData(opts) {
        return __awaiter(this, void 0, void 0, function* () {
            const [campaigns, sessions, subjects] = yield Promise.all([
                this.fetchCampaignsNoActive(opts),
                this.fetchSessionsNoactive(opts),
                this.fetchSubjectsNoactive(opts),
            ]);
            return { campaigns, sessions, subjects };
        });
    }
    UpdateQRNoActive(conn, campaign_id) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
UPDATE exam_campaigns
SET qr_active = 0 where id = ?;
  `;
            yield conn.execute(sql, [campaign_id]);
        });
    }
    UpdateQRActive(conn, campaign_id) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
UPDATE exam_campaigns
SET qr_active = 1 where id = ?;
  `;
            yield conn.execute(sql, [campaign_id]);
        });
    }
}
const examDataRepo = new ExamDataRepo();
exports.default = examDataRepo;
