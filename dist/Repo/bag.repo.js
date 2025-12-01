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
const promise_1 = require("mysql2/promise");
class BagRepo {
    // ⭐️ (FIX 3: REPO GET ต้อง JOIN sessions เพื่อหา campaign_id)
    findAllByCampaignId(campaignId, connection) {
        return __awaiter(this, void 0, void 0, function* () {
            // (แปลง "camp-1" เป็น 1)
            const campaignIdNumeric = parseInt(campaignId.replace("camp-", ""));
            // ⭐️ (FIX 7: ลบการขึ้นบรรทัดใหม่ (Newline) หน้า SELECT)
            const sql = `SELECT
    b.id,
    s.campaign_id,
    b.session_id,
    s.title AS session_label,
    b.bag_no,
    b.count_items,
    b.status,
    CONCAT('BAG-', LPAD(b.bag_no, 3, '0')) AS bag_no_str,
    MIN(sj.code) AS subject_code,    -- ถ้ามีหลายวิชา เลือกตัวแรกๆมา
    MIN(sj.name) AS subject_name
FROM bags b
JOIN sessions s 
  ON b.session_id = s.id
LEFT JOIN session_subjects ss 
  ON s.id = ss.session_id 
LEFT JOIN subjects sj 
  ON ss.subject_id = sj.id
WHERE s.campaign_id = ?
GROUP BY
    b.id,
    s.campaign_id,
    b.session_id,
    s.title,
    b.bag_no,
    b.count_items,
    b.status
ORDER BY
    b.bag_no ASC;

`;
            try {
                const [rows] = yield connection.execute(sql, [campaignIdNumeric]);
                return rows;
            }
            catch (error) {
                console.error("Repo Error (Bag FindAll):", error);
                throw error;
            }
        });
    }
    getMaxBagNoForSession(sessionId, connection) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const sql = `
      SELECT COALESCE(MAX(bag_no), 0) AS max_no
      FROM bags
      WHERE session_id = ?
      FOR UPDATE;
    `;
            const [rows] = yield connection.execute(sql, [sessionId]);
            const row = rows[0];
            return (_a = row === null || row === void 0 ? void 0 : row.max_no) !== null && _a !== void 0 ? _a : 0;
        });
    }
    bulkCreate(bags, connection) {
        return __awaiter(this, void 0, void 0, function* () {
            if (bags.length === 0)
                return;
            const values = bags.map(b => [b.session_id, b.bag_no, b.count_items, b.status]);
            const sql = (0, promise_1.format)("INSERT INTO bags (session_id, bag_no, count_items, status) VALUES ?", [values]);
            try {
                const [result] = yield connection.query(sql);
                return result;
            }
            catch (error) {
                console.error("Repo Error (Bag Bulk Create):", error);
                throw error;
            }
        });
    }
    /**
     * (Update Bag Status)
     */
    updateStatus(bagId, status, connection) {
        return __awaiter(this, void 0, void 0, function* () {
            // ⭐️ (FIX 4) อัปเดตโดยใช้ bag_no (ที่เป็น String ID)
            const sql = `UPDATE bags SET status = ? WHERE bag_no = ?;`;
            try {
                const [result] = yield connection.execute(sql, [status, bagId]);
                return result;
            }
            catch (error) {
                console.error("Repo Error (Bag Update Status):", error);
                throw error;
            }
        });
    }
    deleteById(bagNo, connection) {
        return __awaiter(this, void 0, void 0, function* () {
            // (ลบโดยใช้ bag_no ที่เป็น VARCHAR)
            const sql = `DELETE FROM bags WHERE bag_no = ?;`;
            try {
                const [result] = yield connection.execute(sql, [bagNo]);
                return result;
            }
            catch (error) {
                console.error("Repo Error (Bag Delete):", error);
                throw error;
            }
        });
    }
    findByCampaignAndBagNo(conn, campaignId, bagNo) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
      SELECT b.id, b.session_id, b.bag_no
      FROM bags b
      JOIN sessions s
        ON b.session_id = s.id
      WHERE s.campaign_id = ?
        AND b.bag_no = ?
      LIMIT 1;
    `;
            const [rows] = yield conn.execute(sql, [campaignId, bagNo]);
            return rows[0] || null;
        });
    }
}
const bagRepo = new BagRepo();
exports.default = bagRepo;
