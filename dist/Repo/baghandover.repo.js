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
class BagLogRepo {
    /**
     * ดึง log ทั้งหมดของ campaign หนึ่ง (ใช้ไปสรุป locks + logs)
     */
    findByCampaignId(campaignIdNumeric, connection) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
      SELECT
        bl.id,
        s.campaign_id,
        bl.session_id,
        bl.bag_no,
        bl.action,
        bl.grader_id,
        ag.full_name AS grader_name,   -- ✅ เอาชื่อจาก accounts อย่างเดียว
        bl.operator_id,
        ao.full_name AS operator_name,
        bl.at_time,
        bl.note
      FROM bag_logs bl
      JOIN sessions s
        ON bl.session_id = s.id
      LEFT JOIN graders g
        ON bl.grader_id = g.id
      LEFT JOIN accounts ag
        ON g.account_id = ag.id       -- ชื่อผู้ตรวจ (จาก accounts)
      LEFT JOIN accounts ao
        ON bl.operator_id = ao.id     -- ชื่อ operator (จาก accounts)
      WHERE s.campaign_id = ?
      ORDER BY bl.at_time ASC, bl.id ASC;
    `;
            const [rows] = yield connection.query(sql, [campaignIdNumeric]);
            return rows;
        });
    }
    /**
     * Insert log action = ISSUE (ลงทะเบียนถุงให้ผู้ตรวจ)
     */
    insertIssueLog(input, connection) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const sql = `
      INSERT INTO bag_logs (session_id, bag_no, action, grader_id, operator_id, note)
      VALUES (?, ?, 'ISSUE', ?, ?, ?);
    `;
            const params = [
                input.session_id,
                input.bag_no,
                input.grader_id,
                input.operator_id,
                (_a = input.note) !== null && _a !== void 0 ? _a : null,
            ];
            yield connection.execute(sql, params);
        });
    }
    /**
     * Insert log action = RETURN (รับคืนถุง)
     */
    insertReturnLog(input, connection) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const sql = `
      INSERT INTO bag_logs (session_id, bag_no, action, grader_id, operator_id, note)
      VALUES (?, ?, 'RETURN', NULL, ?, ?);
    `;
            const params = [
                input.session_id,
                input.bag_no,
                input.operator_id,
                (_a = input.note) !== null && _a !== void 0 ? _a : null,
            ];
            yield connection.execute(sql, params);
        });
    }
    /**
     * อัปเดตสถานะถุงในตาราง bags
     * status: CREATED | ISSUED | RETURNED (ตาม DDL)
     */
    updateBagStatus(sessionId, bagNo, status, connection) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
      UPDATE bags
      SET status = ?
      WHERE session_id = ? AND bag_no = ?;
    `;
            yield connection.execute(sql, [status, sessionId, bagNo]);
        });
    }
    /**
     * verify ว่าถุงนี้อยู่ใน session นี้จริงหรือไม่ (option แต่แนะนำ)
     */
    ensureBagExists(sessionId, bagNo, connection) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
      SELECT 1
      FROM bags
      WHERE session_id = ? AND bag_no = ?
      LIMIT 1;
    `;
            const [rows] = yield connection.execute(sql, [sessionId, bagNo]);
            const arr = rows;
            return arr.length > 0;
        });
    }
}
const bagLogRepo = new BagLogRepo();
exports.default = bagLogRepo;
// const sql = `
//   SELECT
//     bl.id,
//     s.campaign_id,
//     bl.session_id,
//     bl.bag_no,
//     bl.action,
//     bl.grader_id,
//     ag.full_name AS grader_name,   -- ✅ เอาชื่อจาก accounts อย่างเดียว
//     bl.operator_id,
//     ao.full_name AS operator_name,
//     bl.at_time,
//     bl.note
//   FROM bag_logs bl
//   JOIN sessions s
//     ON bl.session_id = s.id
//   LEFT JOIN graders g
//     ON bl.grader_id = g.id
//   LEFT JOIN accounts ag
//     ON g.account_id = ag.id       -- ชื่อผู้ตรวจ (จาก accounts)
//   LEFT JOIN accounts ao
//     ON bl.operator_id = ao.id     -- ชื่อ operator (จาก accounts)
//   WHERE s.campaign_id = ?
//   ORDER BY bl.at_time ASC, bl.id ASC;
// `;
