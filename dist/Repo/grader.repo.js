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
class GraderRepo {
    /**
     * ดึง "ข้อที่ถูก assign ให้ตรวจแล้ว" ของ campaign หนึ่ง
     * ใช้ join grading_slots + graders
     */
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
        ga.question_no
    FROM grader_assignments ga
    JOIN graders g
      ON ga.grader_id = g.id
    JOIN sessions s
      ON ga.session_id = s.id
    JOIN subjects subj
      ON ga.subject_id = subj.id
    LEFT JOIN accounts a
      ON g.account_id = a.id
    WHERE g.campaign_id = ?      -- campaign ปัจจุบัน
    ORDER BY ga.question_no ASC; -- จะใส่ order by เพิ่มก็ได้
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
    // ----- ด้านล่างยังเก็บ helper เดิมไว้ เผื่อใช้ manage grader ภายหลัง -----
    create(data, connection) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const sql = `
      INSERT INTO graders (campaign_id, name, active, account_id)
      VALUES (?, ?, ?, ?);
    `;
            try {
                const [result] = yield connection.execute(sql, [
                    data.campaign_id,
                    data.name,
                    (_a = data.active) !== null && _a !== void 0 ? _a : true,
                    (_b = data.account_id) !== null && _b !== void 0 ? _b : null,
                ]);
                return result;
            }
            catch (error) {
                console.error("Repo Error (Grader create):", error);
                throw error;
            }
        });
    }
    updateById(id, data, connection) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const sql = `
      UPDATE graders
      SET
        name       = COALESCE(?, name),
        active     = COALESCE(?, active),
        account_id = COALESCE(?, account_id)
      WHERE id = ?;
    `;
            try {
                const [result] = yield connection.execute(sql, [
                    (_a = data.name) !== null && _a !== void 0 ? _a : null,
                    typeof data.active === "boolean" ? (data.active ? 1 : 0) : null,
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
}
const graderRepo = new GraderRepo();
exports.default = graderRepo;
