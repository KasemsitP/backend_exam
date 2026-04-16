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
const promise_1 = require("mysql2/promise");
class BagRepo {
    constructor() {
        this.pool = DB_1.DB.getInstance();
    }
    //  (FIX 3: REPO GET ต้อง JOIN sessions เพื่อหา campaign_id)
    findAllByCampaignId(campaignId, connection) {
        return __awaiter(this, void 0, void 0, function* () {
            // (แปลง "camp-1" เป็น 1)
            const campaignIdNumeric = parseInt(campaignId.replace("camp-", ""));
            //  (FIX 7: ลบการขึ้นบรรทัดใหม่ (Newline) หน้า SELECT)
            //     const sql = `
            // SELECT
            //   b.id,
            //   s.campaign_id,
            //   b.session_id,
            //   s.title AS session_label,
            //   b.bag_no,
            //   b.count_items,
            //   b.status,
            //   CONCAT('BAG-', LPAD(b.bag_no, 3, '0')) AS bag_no_str,
            //   MIN(sj.code) AS subject_code,
            //   MIN(sj.name) AS subject_name,
            //   COALESCE(bs.scanned_count, 0) AS scanned_count   -- 👈 เพิ่มตรงนี้
            // FROM bags b
            // JOIN sessions s 
            //   ON b.session_id = s.id
            // LEFT JOIN session_subjects ss 
            //   ON s.id = ss.session_id 
            // LEFT JOIN subjects sj 
            //   ON ss.subject_id = sj.id
            // LEFT JOIN (                                      -- 👈 นับจำนวนเล่มในแต่ละถุง
            //   SELECT
            //     session_id,
            //     bag_no,
            //     COUNT(*) AS scanned_count
            //   FROM booklets
            //   GROUP BY session_id, bag_no
            // ) bs
            //   ON bs.session_id = b.session_id
            //  AND bs.bag_no     = b.bag_no
            // WHERE s.campaign_id = ?
            // GROUP BY
            //   b.id,
            //   s.campaign_id,
            //   b.session_id,
            //   s.title,
            //   b.bag_no,
            //   b.count_items,
            //   b.status,
            //   bs.scanned_count
            // ORDER BY
            //   b.bag_no ASC;
            // `;
            const sql = `SELECT
  b.id,
  s.campaign_id,
  b.session_id,
  b.bag_no,
  b.count_items,
  b.status,
  CONCAT('BAG-', LPAD(b.bag_no, 3, '0')) AS bag_no_str,
  MIN(sj.code) AS subject_code,
  MIN(sj.name) AS session_label,
  MAX(COALESCE(bs.scanned_count, 0)) AS scanned_count
FROM bags b
JOIN sessions s 
  ON b.session_id = s.id
LEFT JOIN session_subjects ss 
  ON s.id = ss.session_id 
LEFT JOIN subjects sj 
  ON ss.subject_id = sj.id
LEFT JOIN (
  SELECT
    bag_id,
    COUNT(*) AS scanned_count
  FROM booklets
  WHERE bag_id IS NOT NULL
  GROUP BY bag_id
) bs
  ON bs.bag_id = b.id
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
    updateStatus(bag_no, status, session_id, connection) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `UPDATE bags SET status = ? WHERE bags.id = ? AND bags.session_id = ?`;
            try {
                const [result] = yield connection.execute(sql, [status, bag_no, session_id]);
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
            const sql = `DELETE FROM bags WHERE id = ?;`;
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
            //     const sql = `
            //   SELECT b.id, b.session_id, b.bag_no
            //   FROM bags b
            //   JOIN sessions s
            //     ON b.session_id = s.id
            //   WHERE s.campaign_id = ?
            //     AND b.bag_no = ?
            //   LIMIT 1;
            // `;
            const sql = `
      SELECT b.id, b.session_id, b.bag_no
      FROM bags b
      JOIN sessions s
        ON b.session_id = s.id
      WHERE s.campaign_id = ?
        AND b.id = ?
      LIMIT 1;
    `;
            const [rows] = yield conn.execute(sql, [campaignId, bagNo]);
            return rows[0] || null;
        });
    }
    findScannCountByCampaign(conn, campaignId) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
SELECT
  b.id,
  s.campaign_id,
  b.session_id,
  s.title                AS session_label,
  b.bag_no,
  b.count_items,    
  b.status,
  LPAD(b.bag_no, 3, '0') AS bag_no_str,
  COALESCE(bs.scanned_count, 0) AS scanned_count
FROM bags b
JOIN sessions s
  ON b.session_id = s.id
LEFT JOIN (
  --
  SELECT
    bag_id,
    COUNT(*) AS scanned_count
  FROM booklets
  WHERE bag_id IS NOT NULL -- นับเฉพาะเล่มที่สแกนลงถุงแล้ว
  GROUP BY bag_id
) bs
  ON bs.bag_id = b.id -- 
WHERE s.campaign_id = ?
ORDER BY b.session_id ASC, b.bag_no ASC; -- 
    `;
            const [rows] = yield conn.execute(sql, [campaignId]);
            return rows || null;
        });
    }
    findById(connection, id) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const sql = `
      SELECT b.*, s.campaign_id
      FROM bags b
      JOIN sessions s ON b.session_id = s.id
      WHERE b.id = ?
      LIMIT 1;
    `;
            const [rows] = yield connection.execute(sql, [id]);
            const arr = rows;
            return (_a = arr[0]) !== null && _a !== void 0 ? _a : null;
        });
    }
    findByIdNoConn(id) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const sql = `
      SELECT b.*, s.campaign_id
      FROM bags b
      JOIN sessions s ON b.session_id = s.id
      WHERE b.id = ?
      LIMIT 1;
    `;
            const [rows] = yield this.pool.execute(sql, [id]);
            const arr = rows;
            return (_a = arr[0]) !== null && _a !== void 0 ? _a : null;
        });
    }
    CheckSubjectBooks(session_id) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
SELECT s.name from subjects s JOIN session_subjects ss ON   ss.subject_id = s.id WHERE  ss.session_id = ?;
    `;
            const [rows] = yield this.pool.execute(sql, [session_id]);
            const arr = rows;
            return arr[0];
        });
    }
    CheckSubjectBooksConn(session_id, connection) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const sql = `
    SELECT s.name AS subject_name
    FROM subjects s
    JOIN session_subjects ss ON ss.subject_id = s.id
    WHERE ss.session_id = ?
    LIMIT 1;
  `;
            const [rows] = yield connection.execute(sql, [session_id]);
            const arr = rows;
            return (_a = arr[0]) !== null && _a !== void 0 ? _a : null;
        });
    }
    findBySessionAndNo(connection, sessionId, bagNo) {
        return __awaiter(this, void 0, void 0, function* () {
            // แก้ไข SQL: เพิ่ม JOIN sessions เพื่อเอา campaign_id
            const sql = `
    SELECT
      b.*,
      s.campaign_id
    FROM bags b
    JOIN sessions s ON b.session_id = s.id
    WHERE b.session_id = ? AND b.bag_no = ?
    LIMIT 1;
  `;
            const [rows] = yield connection.execute(sql, [sessionId, bagNo]);
            const arr = rows;
            return arr.length > 0 ? arr[0] : null;
        });
    }
    CreateBagByConnection(session_id, max_no, connection) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `INSERT INTO bags (session_id, bag_no, count_items, status) VALUES (?, ?, ?, ?);`;
            try {
                const [result] = yield connection.query(sql, [session_id, max_no, 30, 'SEALED']);
                return {
                    insertId: result.insertId,
                    affectedRows: result.affectedRows,
                };
            }
            catch (error) {
                console.error("Repo Error (Bag Bulk Create):", error);
                throw error;
            }
        });
    }
    getAllBagNumbersForSession(sessionId, conn) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `SELECT bag_no FROM bags WHERE session_id = ?`;
            const [rows] = yield conn.execute(sql, [sessionId]);
            return rows.map(r => r.bag_no);
        });
    }
    getActiveBagNumbers(sessionId, conn) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
        SELECT bag_no 
        FROM bags 
        WHERE session_id = ? 
        AND (
            status = 'COMPLETED' 
            OR (status = 'DRAFT' AND created_at >= NOW() - INTERVAL 15 MINUTE)
        )
    `;
            const [rows] = yield conn.execute(sql, [sessionId]);
            return rows.map(r => r.bag_no);
        });
    }
    updateBagStatusToCompleted(bagId, conn) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `UPDATE bags SET status = 'COMPLETED' WHERE id = ?`;
            yield conn.execute(sql, [bagId]);
        });
    }
    insertDraftBag(sessionId, bagNo, connection) {
        return __awaiter(this, void 0, void 0, function* () {
            // ตั้งค่า status เป็น DRAFT และ count_items เป็น 0 ไปก่อน
            const sql = `
        INSERT INTO bags (session_id, bag_no, status, count_items) 
        VALUES (?, ?, 'DRAFT', 0)
    `;
            const [result] = yield connection.execute(sql, [sessionId, bagNo]);
            // return result กลับไป เพื่อให้เราดึง result.insertId ไปใช้เป็น bagId ได้
            return result;
        });
    }
    getEmptyBag(sessionId, conn) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
        SELECT b.id, b.bag_no 
        FROM bags b
        LEFT JOIN booklets bk ON bk.bag_id = b.id
        WHERE b.session_id = ? 
        GROUP BY b.id, b.bag_no
        HAVING COUNT(bk.id) = 0
        ORDER BY b.bag_no ASC
        LIMIT 1
    `;
            const [rows] = yield conn.execute(sql, [sessionId]);
            return rows.length > 0 ? { id: rows[0].id, bag_no: rows[0].bag_no } : null;
        });
    }
    findBagPayloadRows(bagId) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
      SELECT bb.bag_no,b.random_num , b.qr_payload FROM booklets b JOIN bags bb ON bb.id = b.bag_id where bag_id = ? 
ORDER BY random_num ASC;`;
            const [rows] = yield this.pool.execute(sql, [bagId]);
            return rows;
        });
    }
    findBagPayloadRowsWithSubject(bagId) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
SELECT
  ba.id AS bag_id,
  ba.bag_no,
  s.id AS session_id,
  s.session_code,
  s.exam_date,
  es.id AS campaign_id,
  es.campaign_size,
  es.site,
  es.name AS campaign_name,
  sub.id AS subject_id,
  sub.code AS subject_code,
  sub.name AS subject_name,
  ss.start_at,
  ss.end_at,
  ss.question_count,
  ss.order_no
FROM bags ba
JOIN sessions s
  ON s.id = ba.session_id
JOIN exam_campaigns es
  ON es.id = s.campaign_id
JOIN session_subjects ss
  ON ss.session_id = s.id
JOIN subjects sub
  ON sub.id = ss.subject_id
WHERE ba.id = ?;`;
            const [rows] = yield this.pool.execute(sql, [bagId]);
            return rows;
        });
    }
    findAllBagPayloadRowsByCampaignId(campaignId) {
        return __awaiter(this, void 0, void 0, function* () {
            const connection = yield DB_1.DB.getInstance().getConnection();
            try {
                const [rows] = yield connection.query(`
            SELECT
                b.id AS bag_id,
                b.bag_no,
                bk.random_num,
                bk.qr_payload,
                s.id AS session_id,
                s.session_code,
                sub.name AS subject_name,
                CONCAT(ec.campaign_size, ' ', ec.year_be) AS campaign_name,
                ec.site,
                CONCAT('วันสอบที่ ', s.day_no, ' / ', sub.name) AS session_label
            FROM bags b
            INNER JOIN sessions s
                ON s.id = b.session_id
            INNER JOIN exam_campaigns ec
                ON ec.id = s.campaign_id
            INNER JOIN booklets bk
                ON bk.bag_id = b.id
            INNER JOIN session_subjects ss
                ON ss.session_id = s.id
            INNER JOIN subjects sub
                ON sub.id = ss.subject_id
            WHERE ec.id = ?
            ORDER BY b.bag_no ASC, bk.random_num ASC
            `, [campaignId]);
                return rows;
            }
            finally {
                connection.release();
            }
        });
    }
    findAllBagPayloadRowsBySession(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            const connection = yield DB_1.DB.getInstance().getConnection();
            try {
                const [rows] = yield connection.query(`
            SELECT
                b.id AS bag_id,
                b.bag_no,
                bk.random_num,
                bk.qr_payload,
                s.id AS session_id,
                s.session_code,
                sub.name AS subject_name,
                CONCAT(ec.campaign_size, ' ', ec.year_be) AS campaign_name,
                ec.site,
                CONCAT('วันสอบที่ ', s.day_no, ' / ', sub.name) AS session_label
            FROM bags b
            INNER JOIN sessions s
                ON s.id = b.session_id
            INNER JOIN exam_campaigns ec
                ON ec.id = s.campaign_id
            INNER JOIN booklets bk
                ON bk.bag_id = b.id
            INNER JOIN session_subjects ss
                ON ss.session_id = s.id
            INNER JOIN subjects sub
                ON sub.id = ss.subject_id
            WHERE s.id = ?
            ORDER BY b.bag_no ASC, bk.random_num ASC
            `, [sessionId]);
                return rows;
            }
            finally {
                connection.release();
            }
        });
    }
}
const bagRepo = new BagRepo();
exports.default = bagRepo;
