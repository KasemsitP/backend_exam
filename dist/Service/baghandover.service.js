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
const parseCampaignId = (id) => {
    // รองรับทั้ง "camp-1" หรือ "1"
    if (id.startsWith("camp-")) {
        return parseInt(id.replace("camp-", ""), 10);
    }
    return parseInt(id, 10);
};
const toCampaignString = (id) => `camp-${id}`;
const mapDbRowToLogDto = (row) => {
    const campaignIdStr = toCampaignString(row.campaign_id);
    // mapping action DB → frontend
    // ISSUE/TRANSFER = "ถุงกำลังถูกถือ" → CHECK_OUT
    // RETURN         = "ถุงคืนแล้ว"      → CHECK_IN
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
/**
 * สร้าง locks จาก log ทั้งหมด:
 * - group ตาม (session_id, bag_no)
 * - เอาแถวสุดท้ายของแต่ละถุง
 * - ถ้า action สุดท้ายเป็น ISSUE/TRANSFER → ถือว่าถุงกำลังถูกตรวจ (locked)
 * - ถ้า RETURN → ถุงว่าง (ไม่ lock)
 */
const deriveLocksFromLogs = (rows) => {
    var _a, _b, _c, _d, _e, _f;
    const lastByBagKey = new Map();
    for (const row of rows) {
        const key = `${row.session_id}-${row.bag_no}`;
        // rows มาตามเวลา ASC อยู่แล้ว แค่ override ก็ได้ last
        lastByBagKey.set(key, row);
    }
    const locks = [];
    for (const row of lastByBagKey.values()) {
        if (row.action === "RETURN") {
            continue; // คืนแล้ว ไม่ lock
        }
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
    /**
     * GET ทั้ง locks + logs สำหรับ 1 campaign
     */
    static getForCampaign(campaignId) {
        return __awaiter(this, void 0, void 0, function* () {
            const connection = yield DB_1.DB.getInstance().getConnection();
            try {
                const campaignIdNumeric = parseCampaignId(campaignId);
                const rows = yield baghandover_repo_1.default.findByCampaignId(campaignIdNumeric, connection);
                const locks = deriveLocksFromLogs(rows);
                const logs = rows.map(mapDbRowToLogDto).reverse(); // ให้ log ใหม่อยู่บนสุด
                return { locks, logs };
            }
            finally {
                connection.release();
            }
        });
    }
    /**
     * Check-in = ลงทะเบียนถุงให้ผู้ตรวจ (action = ISSUE)
     */
    static checkIn(payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const connection = yield DB_1.DB.getInstance().getConnection();
            try {
                yield connection.beginTransaction();
                const { sessionId, bagNo, graderId, operatorId, note } = payload;
                // optional: ตรวจว่าถุงนี้มีจริงไหม
                const exists = yield baghandover_repo_1.default.ensureBagExists(sessionId, bagNo, connection);
                if (!exists) {
                    throw new Error(`ไม่พบถุงใน session_id=${sessionId}, bag_no=${bagNo}`);
                }
                yield baghandover_repo_1.default.insertIssueLog({
                    session_id: sessionId,
                    bag_no: bagNo,
                    grader_id: graderId,
                    operator_id: operatorId,
                    note: note !== null && note !== void 0 ? note : null,
                }, connection);
                yield baghandover_repo_1.default.updateBagStatus(sessionId, bagNo, "ISSUED", connection);
                yield connection.commit();
                return { success: true };
            }
            catch (err) {
                yield connection.rollback();
                throw err;
            }
            finally {
                connection.release();
            }
        });
    }
    /**
     * Check-out = รับคืนถุง (action = RETURN)
     */
    static checkOut(payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const connection = yield DB_1.DB.getInstance().getConnection();
            try {
                yield connection.beginTransaction();
                const { sessionId, bagNo, operatorId, note } = payload;
                const exists = yield baghandover_repo_1.default.ensureBagExists(sessionId, bagNo, connection);
                if (!exists) {
                    throw new Error(`ไม่พบถุงใน session_id=${sessionId}, bag_no=${bagNo}`);
                }
                yield baghandover_repo_1.default.insertReturnLog({
                    session_id: sessionId,
                    bag_no: bagNo,
                    operator_id: operatorId,
                    note: note !== null && note !== void 0 ? note : null,
                }, connection);
                yield baghandover_repo_1.default.updateBagStatus(sessionId, bagNo, "RETURNED", connection);
                yield connection.commit();
                return { success: true };
            }
            catch (err) {
                yield connection.rollback();
                throw err;
            }
            finally {
                connection.release();
            }
        });
    }
}
exports.BagHandoverService = BagHandoverService;
