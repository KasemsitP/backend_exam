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
class RankingReportRepo {
    constructor() {
        this.pool = DB_1.DB.getInstance();
    }
    getExamInfo(campaignId) {
        return __awaiter(this, void 0, void 0, function* () {
            const [rows] = yield this.pool.query(`SELECT year_be, site, campaign_size, name FROM exam_campaigns WHERE id = ? LIMIT 1`, [campaignId]);
            return rows[0];
        });
    }
    // ดึงคะแนนรายข้อ (ที่เฉลี่ยแล้ว) ของผู้สอบทุกคน ในวิชาที่เลือก (subjectIds)
    getRankingRawRows(opts) {
        return __awaiter(this, void 0, void 0, function* () {
            if (opts.subjectIds.length === 0)
                return [];
            const placeholders = opts.subjectIds.map(() => "?").join(",");
            const [rows] = yield this.pool.query(`
      SELECT 
        b.id AS booklet_id,
        b.session_id,
        u.user_code,
        u.full_name,
        u.title,
        uc.room_code,
        gs1.subject_id,
        gs1.question_no,
        
        -- Logic คะแนนเฉลี่ย: ถ้ามีคะแนนครบ 2 คนให้นำมาเฉลี่ย
        CASE 
          WHEN sc1.score IS NOT NULL AND sc2.score IS NOT NULL 
          THEN (sc1.score + sc2.score)/2 
          ELSE NULL 
        END AS avg_score,

        -- เช็คสถานะว่าตรวจครบ 2 คนไหม
        CASE 
          WHEN sc1.score IS NOT NULL AND sc2.score IS NOT NULL THEN 1 ELSE 0 
        END AS has_both

      FROM booklets b
      JOIN user_sessions us ON us.id = b.user_session_id
      JOIN user_campaigns uc ON uc.id = us.user_campaign_id
      JOIN users u ON u.id = uc.user_id
      
      -- Join Grader 1 (Main)
      JOIN grading_slots gs1 
        ON gs1.booklet_id = b.id 
        AND gs1.grader_order = 1
        AND gs1.subject_id IN (${placeholders})

      -- Join Grader 2 (Pair)
      LEFT JOIN grading_slots gs2 
        ON gs2.booklet_id = b.id 
        AND gs2.grader_order = 2
        AND gs2.subject_id = gs1.subject_id 
        AND gs2.question_no = gs1.question_no

      -- Join Score 1
      LEFT JOIN grading_scores sc1 ON sc1.slot_id = gs1.id
      -- Join Score 2
      LEFT JOIN grading_scores sc2 ON sc2.slot_id = gs2.id

      WHERE us.campaign_id = ?
      ORDER BY u.user_code ASC, gs1.subject_id ASC, gs1.question_no ASC
      `, [...opts.subjectIds, opts.campaignId]);
            return rows;
        });
    }
}
exports.default = new RankingReportRepo();
