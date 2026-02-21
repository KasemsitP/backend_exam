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
class BookletsRepo {
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
        us.qr_payload  AS qr_payload,
        u.user_code,
        u.full_name,
        bk.created_at
      FROM booklets bk
      join bags b on b.id = bk.bag_id
      JOIN user_sessions us
        ON bk.user_session_id = us.id
      JOIN user_campaigns uc
        ON us.user_campaign_id = uc.id
      JOIN users u
        ON uc.user_id = u.id
      WHERE us.campaign_id = ?
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
    findBookletsbyQRpayload(conn, campaignId, sessionId, user_code) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
SELECT
        bk.id          AS booklet_id,
        bk.session_id,
        bk.bag_id,
        bk.seq_in_bag,
        bk.status,
        us.qr_payload  AS qr_payload,
        u.user_code,
        u.full_name,
        b.bag_no,
        bk.created_at
      FROM booklets bk
      join bags b on b.id = bk.bag_id
      JOIN user_sessions us
        ON bk.user_session_id = us.id
      JOIN user_campaigns uc
        ON us.user_campaign_id = uc.id
      JOIN users u
        ON uc.user_id = u.id
      WHERE us.campaign_id = ?
        AND bk.session_id = ?
        AND u.user_code = ?
      ORDER BY bk.seq_in_bag ASC, bk.id ASC;
    `;
            const [rows] = yield conn.execute(sql, [
                campaignId,
                sessionId,
                user_code,
            ]);
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
}
const bookletsRepo = new BookletsRepo();
exports.default = bookletsRepo;
