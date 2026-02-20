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
     * ดึง log ทั้งหมดของ campaign
     * แก้ไข: JOIN จาก bag_logs -> bags -> sessions
     */
    findByCampaignId(campaignIdNumeric, connection) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
      SELECT
        bl.id,
        s.campaign_id,
        b.session_id,       -- ดึงจาก bags
        b.bag_no,           -- ดึงจาก bags
        bl.bag_id,
        bl.action,
        bl.grader_id,
        ag.full_name AS grader_name,
        bl.operator_id,
        ao.full_name AS operator_name,
        bl.at_time,
        bl.note
      FROM bag_logs bl
      JOIN bags b ON bl.bag_id = b.id        -- JOIN bags ด้วย bag_id
      JOIN sessions s ON b.session_id = s.id -- JOIN sessions ต่อจาก bags
      LEFT JOIN graders g ON bl.grader_id = g.id
      LEFT JOIN accounts ag ON g.account_id = ag.id
      LEFT JOIN accounts ao ON bl.operator_id = ao.id
      WHERE s.campaign_id = ?
      ORDER BY bl.at_time ASC, bl.id ASC;
    `;
            const [rows] = yield connection.query(sql, [campaignIdNumeric]);
            return rows;
        });
    }
    /**
     * Insert log action = ISSUE
     * แก้ไข: Insert ลง column bag_id
     */
    insertIssueLog(input, connection) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const sql = `
      INSERT INTO bag_logs (bag_id, action, grader_id, operator_id, note)
      VALUES (?, 'ISSUE', ?, ?, ?);
    `;
            const params = [
                input.bag_id,
                input.grader_id,
                input.operator_id,
                (_a = input.note) !== null && _a !== void 0 ? _a : null,
            ];
            yield connection.execute(sql, params);
        });
    }
    /**
     * Insert log action = RETURN
     * แก้ไข: Insert ลง column bag_id
     */
    insertReturnLog(input, connection) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const sql = `
      INSERT INTO bag_logs (bag_id, action, grader_id, operator_id, note)
      VALUES (?, 'RETURN', NULL, ?, ?);
    `;
            const params = [
                input.bag_id,
                input.operator_id,
                (_a = input.note) !== null && _a !== void 0 ? _a : null,
            ];
            yield connection.execute(sql, params);
        });
    }
    /**
     * อัปเดตสถานะถุงในตาราง bags
     * ปรับปรุง: ใช้ bag_id (PK) ในการ update เพื่อความแม่นยำและเร็วขึ้น
     */
    updateBagStatus(bagId, status, connection) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
      UPDATE bags
      SET status = ?
      WHERE id = ?;
    `;
            yield connection.execute(sql, [status, bagId]);
        });
    }
}
const bagLogRepo = new BagLogRepo();
exports.default = bagLogRepo;
