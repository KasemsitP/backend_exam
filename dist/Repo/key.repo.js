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
class KeyRepo {
    constructor() {
        this.pool = DB_1.DB.getInstance();
    }
    findAllByCampaignId(campaignId_1) {
        return __awaiter(this, arguments, void 0, function* (campaignId, dbClient = this.pool) {
            const sql = "SELECT ck.id , ck.campaign_id , ck.account_id , a.full_name , ck.key , ck.algor , ck.iv , ck.active , ck.created_at , ck.order_num FROM campaign_keys ck JOIN accounts a on ck.account_id = a.id WHERE campaign_id = ?;";
            const [rows] = yield dbClient.execute(sql, [campaignId]);
            return rows;
        });
    }
    findAllByCampaignIdByManager(campaignId_1, AccountId_1) {
        return __awaiter(this, arguments, void 0, function* (campaignId, AccountId, dbClient = this.pool) {
            const sql = `
    SELECT ck.id , ck.campaign_id , ck.account_id , a.full_name , ck.key , ck.active , ck.created_at , ck.order_num , a.manager_order 
FROM campaign_keys ck JOIN accounts a on ck.account_id = a.id WHERE campaign_id = ? AND account_id = ?;
    `;
            const [rows] = yield dbClient.execute(sql, [campaignId, AccountId]);
            return rows;
        });
    }
    countByCampaignId(campaignId_1) {
        return __awaiter(this, arguments, void 0, function* (campaignId, dbClient = this.pool) {
            const sql = "SELECT COUNT(*) as count FROM campaign_keys WHERE campaign_id = ?";
            const [rows] = yield dbClient.execute(sql, [campaignId]);
            return rows[0].count;
        });
    }
    //select s.id from sessions s JOIN exam_campaigns ec on s.campaign_id = ec.id WHERE campaign_id = ?;
    selectSessionIdByCampaign(campaignId_1) {
        return __awaiter(this, arguments, void 0, function* (campaignId, dbClient = this.pool) {
            const sql = `
    SELECT s.id
    FROM sessions s
    JOIN exam_campaigns ec ON s.campaign_id = ec.id
    WHERE s.campaign_id = ?
  `;
            const [rows] = yield dbClient.execute(sql, [campaignId]);
            return rows;
        });
    }
    findById(id_1) {
        return __awaiter(this, arguments, void 0, function* (id, dbClient = this.pool) {
            const sql = "SELECT * FROM campaign_keys WHERE id = ?";
            const [rows] = yield dbClient.execute(sql, [id]);
            return rows[0] || null;
        });
    }
    create(payload_1) {
        return __awaiter(this, arguments, void 0, function* (payload, dbClient = this.pool) {
            const sql = `
      INSERT INTO campaign_keys (campaign_id,account_id, \`key\`, iv, algor,order_num) 
      VALUES (?,?, ?, ?, ?, ?)
    `;
            const params = [
                payload.campaign_id,
                payload.account_id,
                payload.key,
                payload.iv,
                payload.algor,
                payload.order_num
            ];
            const [result] = yield dbClient.execute(sql, params);
            const newId = result.insertId;
            const newKey = yield this.findById(newId, dbClient);
            if (!newKey) {
                throw new Error("Failed to retrieve newly created key.");
            }
            return newKey;
        });
    }
    delete(id_1) {
        return __awaiter(this, arguments, void 0, function* (id, dbClient = this.pool) {
            const sql = "DELETE FROM campaign_keys WHERE id = ?";
            const [result] = yield dbClient.execute(sql, [id]);
            return result.affectedRows > 0;
        });
    }
    GetSessionDate(campaign_id) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `SELECT s.exam_date,  sj.start_at , sj.end_at from session_subjects sj JOIN sessions s ON s.id = sj.session_id WHERE s.campaign_id = ?;`;
            const [rows] = yield this.pool.query(sql, [campaign_id]);
            return rows;
        });
    }
    checkRoles(id_1) {
        return __awaiter(this, arguments, void 0, function* (id, dbClient = this.pool) {
            const sql = "SELECT a.id,r.code  FROM roles r JOIN accounts a ON a.role_id = r.id  WHERE a.id = ? limit 1";
            const [rows] = yield dbClient.execute(sql, [id]);
            return rows[0] || null;
        });
    }
    findKeys(id_1, campaign_id_1) {
        return __awaiter(this, arguments, void 0, function* (id, campaign_id, dbClient = this.pool) {
            const sql = "select ck.id , ck.campaign_id , ck.account_id , ck.key , ck.active , ck.order_num from campaign_keys ck WHERE ck.id = ? AND campaign_id = ? limit 1;";
            const [rows] = yield dbClient.execute(sql, [id, campaign_id]);
            return rows[0] || null;
        });
    }
    isAssigned(accountId_1, campaignId_1) {
        return __awaiter(this, arguments, void 0, function* (accountId, campaignId, dbClient = this.pool) {
            var _a;
            const sql = `
    SELECT EXISTS (
      SELECT 1
      FROM campaign_keys
      WHERE account_id = ?
        AND campaign_id = ?
    ) AS is_assigned
  `;
            const [rows] = yield dbClient.execute(sql, [
                accountId,
                campaignId,
            ]);
            return Boolean((_a = rows[0]) === null || _a === void 0 ? void 0 : _a.is_assigned);
        });
    }
    KeyStatus(campaign_id) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
    SELECT
      EXISTS (
        SELECT 1 FROM campaign_keys 
        WHERE order_num = 1 
          AND campaign_id = ?
      ) AS key1_status,

      EXISTS (
        SELECT 1 FROM campaign_keys 
        WHERE order_num = 2 
          AND campaign_id = ?
      ) AS key2_status
  `;
            const [rows] = yield this.pool.query(sql, [
                campaign_id,
                campaign_id,
            ]);
            const result = rows[0];
            return {
                key1_status: Boolean(result.key1_status),
                key2_status: Boolean(result.key2_status),
            };
        });
    }
    updateKeyStatusActive(campaign_id_1) {
        return __awaiter(this, arguments, void 0, function* (campaign_id, dbClient = this.pool) {
            const sql = "UPDATE campaign_keys SET active = 1 WHERE campaign_id = ?";
            const [result] = yield dbClient.execute(sql, [campaign_id]);
            return result.affectedRows > 0;
        });
    }
    updateKeyStatusNonActive(campaign_id_1) {
        return __awaiter(this, arguments, void 0, function* (campaign_id, dbClient = this.pool) {
            const sql = "UPDATE campaign_keys SET active = 0 WHERE campaign_id = ?";
            const [result] = yield dbClient.execute(sql, [campaign_id]);
            return result.affectedRows > 0;
        });
    }
    getKeyCamp(campaign_id_1) {
        return __awaiter(this, arguments, void 0, function* (campaign_id, dbClient = this.pool) {
            const sql = "SELECT ck.id , ck.active from campaign_keys ck WHERE ck.campaign_id = ?;";
            const [rows] = yield dbClient.execute(sql, [campaign_id]);
            if (rows.length === 0) {
                throw new Error("ไม่พบคีย์สำหรับรอบสอบนี้");
            }
            return rows;
        });
    }
    isKeyActive(id_1) {
        return __awaiter(this, arguments, void 0, function* (id, dbClient = this.pool) {
            const sql = "SELECT active FROM campaign_keys WHERE id = ?";
            const [rows] = yield dbClient.execute(sql, [id]);
            if (rows.length === 0) {
                throw new Error("Key not found");
            }
            return rows[0].active === 1;
        });
    }
}
const keyRepo = new KeyRepo();
exports.default = keyRepo;
