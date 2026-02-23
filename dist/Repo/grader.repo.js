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
// src/Repo/grader.repo.ts
const DB_1 = require("../model/DB");
class GraderRepo {
    constructor() {
        this.pool = DB_1.DB.getInstance();
    }
    findAllAssignmentsByCampaignId(campaignIdNumeric, connection) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
SELECT
    ga.grader_id,
    g.account_id,
    g.campaign_id,

    ga.session_id,
    s.session_code,
    s.exam_date,

    ga.subject_id,
    subj.code  AS subject_code,
    subj.name  AS subject_name,

    ga.subject_question_id,
    sq.question_no,          -- << ดึงเลขข้อจาก subject_questions
    sq.max_score ,
    sq.label AS question_label

FROM grader_assignments ga
JOIN graders g
  ON ga.grader_id = g.id
JOIN sessions s
  ON ga.session_id = s.id
JOIN subjects subj
  ON ga.subject_id = subj.id
JOIN subject_questions sq
  ON ga.subject_question_id = sq.id
WHERE g.campaign_id = ?
ORDER BY sq.question_no ASC;
  `;
            try {
                const [rows] = yield connection.execute(sql, [campaignIdNumeric]);
                return rows;
            }
            catch (error) {
                console.error("Repo Error (Grader findAllAssignmentsByCampaignId):", error);
                throw error;
            }
        });
    }
    findAllAssignmentsByCampaignIdByGrader(campaignIdNumeric, connection) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
SELECT
    ga.grader_id,
    g.account_id,
    g.campaign_id,

    ga.session_id,
    s.session_code,
    s.exam_date,

    ga.subject_id,
    subj.code  AS subject_code,
    subj.name  AS subject_name,

    ga.subject_question_id,
    sq.question_no,
    sq.label AS question_label

FROM grader_assignments ga
JOIN graders g
  ON ga.grader_id = g.id
JOIN sessions s
  ON ga.session_id = s.id
JOIN subjects subj
  ON ga.subject_id = subj.id
JOIN subject_questions sq
  ON ga.subject_question_id = sq.id
WHERE g.campaign_id = ?
  AND ga.grader_id = ?      
ORDER BY sq.question_no ASC;

  `;
            try {
                const [rows] = yield connection.execute(sql, [campaignIdNumeric]);
                return rows;
            }
            catch (error) {
                console.error("ดึงข้อมูลวิชาตรวจสำหรับผู้ตรวจผิดพลาด", error);
                throw error;
            }
        });
    }
    findById(id_1) {
        return __awaiter(this, arguments, void 0, function* (id, dbClient = this.pool) {
            const sql = `SELECT * FROM graders WHERE id = ? LIMIT 1`;
            const [rows] = yield dbClient.execute(sql, [id]);
            if (!rows[0]) {
                throw new Error(`Grader ${id} not found`);
            }
            return rows[0];
        });
    }
    getAssignmentByAccountId(campaign_id, account_id) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `SELECT a.id , g.id ,sq.question_no , sq.label , s.session_code , sub.name   FROM grader_assignments ga JOIN graders g ON  
    g.id = ga.grader_id JOIN accounts a ON a.id = g.account_id JOIN subject_questions sq ON sq.id = ga.subject_question_id JOIN sessions s ON ga.session_id = s.id
   	JOIN subjects sub  ON sub.id = sq.subject_id
    WHERE a.id = ? AND g.campaign_id = ?  ORDER BY sq.question_no ASC;`;
            const [rows] = yield this.pool.execute(sql, [account_id, campaign_id]);
            return rows;
        });
    }
    create(payload_1) {
        return __awaiter(this, arguments, void 0, function* (payload, dbClient = this.pool) {
            const sql = `
    INSERT INTO graders (campaign_id, account_id)
    VALUES (?, ?)
  `;
            const params = [
                payload.campaign_id,
                payload.account_id,
            ];
            const [result] = yield dbClient.execute(sql, params);
            const newId = result.insertId;
            return this.findById(newId, dbClient);
        });
    }
    updateById(id, data, connection) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const sql = `
      UPDATE graders
      SET
        name       = COALESCE(?, name),
        account_id = COALESCE(?, account_id)
      WHERE id = ?;
    `;
            try {
                const [result] = yield connection.execute(sql, [
                    (_a = data.name) !== null && _a !== void 0 ? _a : null,
                    (_b = data.account_id) !== null && _b !== void 0 ? _b : null,
                    id,
                ]);
                return result;
            }
            catch (error) {
                console.error("Repo Error (Grader updateById):", error);
                throw error;
            }
        });
    }
    deleteById(id, connection) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `DELETE FROM graders WHERE id = ?;`;
            try {
                const [result] = yield connection.execute(sql, [id]);
                return result;
            }
            catch (error) {
                console.error("Repo Error (Grader deleteById):", error);
                throw error;
            }
        });
    }
    findByCampaignAndAccount(campaignId_1, accountId_1) {
        return __awaiter(this, arguments, void 0, function* (campaignId, accountId, dbClient = this.pool) {
            var _a;
            const sql = `
      SELECT *
      FROM graders
      WHERE campaign_id = ? AND account_id = ?
      LIMIT 1
    `;
            const [rows] = yield dbClient.execute(sql, [
                campaignId,
                accountId,
            ]);
            return (_a = rows[0]) !== null && _a !== void 0 ? _a : null;
        });
    }
}
const graderRepo = new GraderRepo();
exports.default = graderRepo;
