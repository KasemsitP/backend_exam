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
class BookletsRepo {
    constructor() {
        this.pool = DB_1.DB.getInstance();
    }
    // หาค่า seq_in_bag สูงสุดในถุงนี้ (เผื่อมีของเก่าแล้ว จะต่อจากเลขเดิม)
    getMaxSeqInBag(conn, params) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { sessionId, bagNo } = params;
            const sql = `
      SELECT COALESCE(MAX(seq_in_bag), 0) AS max_seq
      FROM booklets
      WHERE session_id = ? AND bag_no = ?
    `;
            const [rows] = yield conn.execute(sql, [sessionId, bagNo]);
            const row = rows[0];
            return (_a = row === null || row === void 0 ? void 0 : row.max_seq) !== null && _a !== void 0 ? _a : 0;
        });
    }
    insertOne(conn, params) {
        return __awaiter(this, void 0, void 0, function* () {
            const { sessionId, userSessionId, bagNo, seqInBag, status, created_at, random_num } = params;
            const sql = `
      INSERT INTO booklets (
        session_id,
        user_session_id,
        bag_id,
        seq_in_bag,
        status,
        created_at,
        random_num
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
            console.log(bagNo);
            const [result] = yield conn.execute(sql, [
                sessionId,
                userSessionId,
                bagNo,
                seqInBag,
                status,
                created_at,
                random_num,
            ]);
            return result.insertId;
        });
    }
    findById(conn, id) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
      SELECT id, session_id, user_session_id, bag_no, seq_in_bag, status
      FROM booklets
      WHERE id = ?
      LIMIT 1;
    `;
            const [rows] = yield conn.execute(sql, [id]);
            return rows[0] || null;
        });
    }
    findByCampaignSessionAndBag(conn, campaignId, sessionId, bagNo) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
      SELECT
        bk.id          AS booklet_id,
        bk.session_id,
        bk.bag_id,
        bk.seq_in_bag,
        bk.status,
        bk.random_num,
        bk.qr_payload,
        bk.created_at,
        b.bag_no
      FROM booklets bk
      JOIN bags b ON b.id = bk.bag_id
      JOIN sessions s ON bk.session_id = s.id
      WHERE s.campaign_id = ?
        AND bk.session_id = ?
        AND b.bag_no   = ?
      ORDER BY bk.seq_in_bag ASC, bk.id ASC;
    `;
            const [rows] = yield conn.execute(sql, [
                campaignId,
                sessionId,
                bagNo,
            ]);
            return rows;
        });
    }
    // 4. หา Booklet ด้วย QR Payload
    findBookletsbyQRpayload(conn, qrPayload) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
      SELECT 
        bk.id, 
        bk.session_id, 
        bk.bag_id, 
        bk.seq_in_bag, 
        bk.status, 
        bk.qr_payload, 
        bk.random_num, 
        bk.created_at,
        b.bag_no
      FROM booklets bk
      JOIN bags b ON b.id = bk.bag_id
      WHERE qr_payload = ?
      LIMIT 1;
    `;
            const [rows] = yield conn.execute(sql, [qrPayload]);
            return rows[0] || null;
        });
    }
    findBookletsbyQRpayloadandBookletsID(conn, qrPayload, bookletsId) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
SELECT 
        bk.id, 
        bk.session_id, 
        bk.bag_id, 
        bk.seq_in_bag, 
        bk.status, 
        bk.qr_payload, 
        bk.random_num, 
        bk.created_at,
        b.bag_no,
        s.name AS subject_name 
      FROM booklets bk
      JOIN bags b ON b.id = bk.bag_id
      JOIN session_subjects ss ON ss.session_id = bk.session_id
      JOIN subjects s ON ss.subject_id = s.id
      WHERE bk.qr_payload = ? 
        AND bk.id = ?
      LIMIT 1;
    `;
            const [rows] = yield conn.execute(sql, [qrPayload, bookletsId]);
            return rows[0] || null;
        });
    }
    getDayno(conn, sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
      SELECT id as session_id, day_no from sessions WHERE id = ? limit 1;
    `;
            const [rows] = yield conn.execute(sql, [
                sessionId,
            ]);
            return rows[0] || null;
        });
    }
    getLatestRandomNumForUpdate(connection, sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = `
        SELECT random_num 
        FROM booklets 
        WHERE session_id = ? AND random_num IS NOT NULL
        ORDER BY id DESC 
        LIMIT 1 
        FOR UPDATE
    `;
            const [rows] = yield connection.query(query, [sessionId]);
            return rows.length > 0 ? rows[0] : null;
        });
    }
    insertMany(conn, values) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
        INSERT INTO booklets 
        (session_id, user_session_id, bag_id, seq_in_bag, status, created_at, random_num) 
        VALUES ?
    `;
            // สังเกตการใช้ [values] เป็น array ซ้อน array สำหรับ mysql2 bulk insert
            yield conn.query(sql, [values]);
        });
    }
    deleteByBagId(conn, bagId) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
        DELETE FROM booklets
        WHERE bag_id = ?
    `;
            // สังเกตการใช้ [values] เป็น array ซ้อน array สำหรับ mysql2 bulk insert
            yield conn.query(sql, [bagId]);
        });
    }
    bulkInsertBooklets(data, connection) {
        return __awaiter(this, void 0, void 0, function* () {
            if (data.length === 0)
                return;
            // แปลง Object Array เป็น Array ของ Array สำหรับ mysql2
            const values = data.map(item => [
                item.session_id,
                item.qr_payload,
                'CREATED' // สถานะเริ่มต้นของ Booklet
            ]);
            const sql = `
        INSERT INTO booklets (session_id, qr_payload, status) 
        VALUES ?
    `;
            yield connection.query(sql, [values]);
        });
    }
    ;
    checkIfSessionEncrypted(sessionId, connection // เปลี่ยน type ให้ตรงกับที่คุณใช้ (เช่น mysql.PoolConnection)
    ) {
        return __awaiter(this, void 0, void 0, function* () {
            // ใช้ SELECT 1 และ LIMIT 1 เพื่อให้ Database ทำงานเร็วที่สุด แค่เจอ record เดียวก็หยุดหา
            const sql = `SELECT 1 FROM booklets WHERE session_id = ? LIMIT 1`;
            const [rows] = yield connection.query(sql, [sessionId]);
            // ถ้ามีความยาวมากกว่า 0 แปลว่าเคยสร้างไปแล้ว คืนค่า true
            return rows.length > 0;
        });
    }
    ;
    findByPayloads(connection, payloads) {
        return __awaiter(this, void 0, void 0, function* () {
            if (payloads.length === 0)
                return [];
            const sql = `SELECT id, session_id, bag_id, seq_in_bag, status, qr_payload, random_num, created_at FROM booklets WHERE qr_payload IN (?)`;
            const [rows] = yield connection.query(sql, [payloads]);
            return rows;
        });
    }
    // 11. อัปเดตข้อมูล Booklet เมื่อถูกจัดลงถุง
    updateBagInfoByPayload(connection, qr_payload, bag_id, seq_in_bag, status, random_num) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
        UPDATE booklets 
        SET bag_id = ?, seq_in_bag = ?, status = ?, random_num = ?
        WHERE qr_payload = ?
    `;
            yield connection.query(sql, [bag_id, seq_in_bag, status, random_num, qr_payload]);
        });
    }
    findPayloadsBySessionId(connection, sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
    SELECT qr_payload
    FROM booklets
    WHERE session_id = ?
  `;
            const [rows] = yield connection.execute(sql, [sessionId]);
            return rows;
        });
    }
    findBlindBookletsByCampaign(conn, campaignId) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
      SELECT b.id, b.qr_payload, b.session_id
      FROM booklets b
      JOIN sessions s ON b.session_id = s.id
      WHERE s.campaign_id = ? 
        AND b.user_id IS NULL 
        AND b.qr_payload IS NOT NULL
    `;
            const [rows] = yield conn.query(sql, [campaignId]);
            return rows;
        });
    }
    // อัปเดตข้อมูลการ Unblind แบบ 1 Query (แก้ไขลำดับ Parameters)
    bulkUpdateUnblindBooklets(conn, updates) {
        return __awaiter(this, void 0, void 0, function* () {
            if (updates.length === 0)
                return;
            let sql = `UPDATE booklets SET `;
            let campaignCases = `campaign_id = CASE id `;
            let codeCases = `user_code = CASE id `;
            const ids = [];
            const campaignParams = [];
            const codeParams = [];
            for (const u of updates) {
                campaignCases += `WHEN ${u.bookletId} THEN ? `;
                codeCases += `WHEN ${u.bookletId} THEN ? `;
                campaignParams.push(u.campaignId);
                codeParams.push(u.userCode);
                ids.push(u.bookletId);
            }
            campaignCases += `END, `;
            codeCases += `END `;
            sql += `${campaignCases} ${codeCases} WHERE id IN (${ids.join(",")})`;
            const finalParams = [...campaignParams, ...codeParams];
            yield conn.query(sql, finalParams);
        });
    }
}
const bookletsRepo = new BookletsRepo();
exports.default = bookletsRepo;
