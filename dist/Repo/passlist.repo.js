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
const SORT_MAP = {
    score: "uc.final_score",
    examCode: "u.user_code",
    name: "u.full_name",
};
const ORDER_MAP = {
    asc: "ASC",
    desc: "DESC",
};
class PassListRepo {
    constructor() {
        this.pool = DB_1.DB.getInstance();
    }
    getPassListRows(opts) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const [examRows] = yield this.pool.query(`
      SELECT year_be, site, campaign_size
      FROM exam_campaigns
      WHERE id = ?
      LIMIT 1
      `, [opts.campaignId]);
            const examInfo = examRows[0];
            if (!examInfo)
                throw new Error("ไม่พบ campaign");
            const sortCol = (_a = SORT_MAP[opts.sort]) !== null && _a !== void 0 ? _a : SORT_MAP.score;
            const sortDir = (_b = ORDER_MAP[opts.order]) !== null && _b !== void 0 ? _b : "DESC";
            // NOTE: เงื่อนไข "ผ่านข้อเขียน" คุณคุมได้เอง เช่น final_score >= 50
            const [rows] = yield this.pool.query(`
      SELECT
        u.user_code AS userCode,
        u.title AS title,
        u.full_name AS fullName,
        uc.final_score AS finalScore
      FROM user_campaigns uc
      JOIN users u ON u.id = uc.user_id
      WHERE uc.campaign_id = ?
        AND (uc.final_score IS NOT NULL)
      ORDER BY
        ${sortCol} ${sortDir},
        u.user_code ASC
      `, [opts.campaignId]);
            return { examInfo, rows: rows };
        });
    }
}
exports.default = new PassListRepo();
