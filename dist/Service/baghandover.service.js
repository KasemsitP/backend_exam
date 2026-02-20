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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BagHandoverService = void 0;
// src/Service/baghandover.service.ts
const DB_1 = require("../model/DB");
const baghandover_repo_1 = __importDefault(require("../Repo/baghandover.repo"));
const bag_repo_1 = __importDefault(require("../Repo/bag.repo")); // 👈 เพิ่ม import นี้ (ใช้หา session_id จาก bag)
const parseCampaignId = (id) => {
    if (id.startsWith("camp-")) {
        return parseInt(id.replace("camp-", ""), 10);
    }
    return parseInt(id, 10);
};
const toCampaignString = (id) => `camp-${id}`;
const mapDbRowToLogDto = (row) => {
    const campaignIdStr = toCampaignString(row.campaign_id);
    const action = row.action === "RETURN" ? "CHECK_IN" : "CHECK_OUT";
    const ts = row.at_time instanceof Date
        ? row.at_time.toISOString()
        : new Date(row.at_time).toISOString();
    return {
        id: String(row.id),
        campaignId: campaignIdStr,
        bagId: row.bag_no,
        action,
        graderId: row.grader_id,
        operatorId: row.operator_id,
        timestamp: ts,
        note: row.note,
    };
};
const deriveLocksFromLogs = (rows) => {
    var _a, _b, _c, _d, _e, _f;
    const lastByBagKey = new Map();
    for (const row of rows) {
        const key = `${row.session_id}-${row.bag_no}`;
        lastByBagKey.set(key, row);
    }
    const locks = [];
    for (const row of lastByBagKey.values()) {
        if (row.action === "RETURN")
            continue;
        const campaignIdStr = toCampaignString(row.campaign_id);
        const ts = row.at_time instanceof Date
            ? row.at_time.toISOString()
            : new Date(row.at_time).toISOString();
        locks.push({
            id: `lock-${campaignIdStr}-${row.session_id}-${row.bag_no}`,
            campaignId: campaignIdStr,
            bagId: row.bag_no,
            graderId: (_a = row.grader_id) !== null && _a !== void 0 ? _a : 0,
            graderName: (_b = row.grader_name) !== null && _b !== void 0 ? _b : `Grader#${(_c = row.grader_id) !== null && _c !== void 0 ? _c : "?"}`,
            operatorId: (_d = row.operator_id) !== null && _d !== void 0 ? _d : 0,
            operatorName: (_e = row.operator_name) !== null && _e !== void 0 ? _e : `Operator#${(_f = row.operator_id) !== null && _f !== void 0 ? _f : "?"}`,
            at: ts,
        });
    }
    return locks;
};
class BagHandoverService {
    static getForCampaign(campaignId) {
        return __awaiter(this, void 0, void 0, function* () {
            const connection = yield DB_1.DB.getInstance().getConnection();
            try {
                // แปลง campaignId จาก string เป็น number
                const campaignIdNumeric = parseCampaignId(campaignId);
                // ดึง log ทั้งหมดของ campaign
                const rows = yield baghandover_repo_1.default.findByCampaignId(campaignIdNumeric, connection);
                const locks = deriveLocksFromLogs(rows);
                const logs = rows
                    .map(mapDbRowToLogDto)
                    .reverse();
                return { locks, logs };
            }
            finally {
                // ปิด connection ไม่ว่าจะ success หรือ error
                connection.release();
            }
        });
    }
    static checkIn(payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const connection = yield DB_1.DB.getInstance().getConnection();
            try {
                yield connection.beginTransaction();
                const { campaignId, bagId, graderId, operatorId, note } = payload;
                const campaignIdNumeric = parseCampaignId(campaignId);
                // 1) หา bag จาก PK
                const bagRow = yield bag_repo_1.default.findById(connection, bagId);
                if (!bagRow) {
                    throw new Error(`ไม่พบถุง id=${bagId}`);
                }
                // Check Campaign
                if (Number(bagRow.campaign_id) !== campaignIdNumeric) {
                    throw new Error(`ถุงไม่ได้อยู่ในแคมเปญนี้ (campaign_id=${bagRow.campaign_id}, current=${campaignIdNumeric})`);
                }
                // 2) insert ISSUE log (ส่ง bagId แทน session/bag_no)
                yield baghandover_repo_1.default.insertIssueLog({
                    bag_id: bagId, // ✅ ใช้ bagId ตาม Schema
                    grader_id: graderId,
                    operator_id: operatorId,
                    note: note !== null && note !== void 0 ? note : null,
                }, connection);
                // 3) update bag status (ส่ง bagId)
                yield baghandover_repo_1.default.updateBagStatus(bagId, // ✅ ใช้ bagId Update ตรงๆ
                "ISSUED", connection);
                yield connection.commit();
                return { success: true };
            }
            catch (err) {
                yield connection.rollback();
                console.error("Service Error (BagHandoverService.checkIn):", err);
                throw err;
            }
            finally {
                connection.release();
            }
        });
    }
    static checkOut(payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const connection = yield DB_1.DB.getInstance().getConnection();
            try {
                yield connection.beginTransaction();
                // 2. รับ sessionId และ bagNo มาแทน bagId
                const { campaignId, sessionId, bagNo, operatorId, note } = payload;
                const campaignIdNumeric = parseCampaignId(campaignId);
                // 3. ค้นหาถุงจาก Session + BagNo เพื่อเอา ID (PK)
                const bagRow = yield bag_repo_1.default.findBySessionAndNo(connection, sessionId, bagNo);
                if (!bagRow) {
                    throw new Error(`ไม่พบถุงหมายเลข ${bagNo} ใน Session ${sessionId}`);
                }
                // 4. ตรวจสอบ Campaign (Validation)
                if (Number(bagRow.campaign_id) !== campaignIdNumeric) {
                    throw new Error(`ถุงไม่ได้อยู่ในแคมเปญนี้ (campaign_id=${bagRow.campaign_id}, current=${campaignIdNumeric})`);
                }
                const bagId = bagRow.id; // ✅ ได้ ID ของจริงมาแล้ว (PK)
                // 5. Insert Log (ใช้ bagId ที่หามาได้)
                yield baghandover_repo_1.default.insertReturnLog({
                    bag_id: bagId, // ส่ง PK ลง DB
                    operator_id: operatorId,
                    note: note !== null && note !== void 0 ? note : null,
                }, connection);
                // 6. Update Status (ใช้ bagId ที่หามาได้)
                yield baghandover_repo_1.default.updateBagStatus(bagId, // ส่ง PK เพื่อ update
                "RETURNED", connection);
                yield connection.commit();
                return { success: true };
            }
            catch (err) {
                yield connection.rollback();
                console.error("Service Error (BagHandoverService.checkOut):", err);
                throw err;
            }
            finally {
                connection.release();
            }
        });
    }
}
exports.BagHandoverService = BagHandoverService;
