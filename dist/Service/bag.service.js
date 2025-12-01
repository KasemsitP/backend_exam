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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.bagService = void 0;
const DB_1 = require("../model/DB");
const key_service_1 = require("./key.service");
const user_session_repo_1 = __importDefault(require("../Repo/user-session.repo"));
const bag_repo_1 = __importDefault(require("../Repo/bag.repo")); // (Import Repo ที่แก้ไขแล้ว)
const booklets_repo_1 = __importDefault(require("../Repo/booklets.repo"));
class bagService {
    static getBookletsInBag(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const { campaignId, sessionId, bagNo } = params;
            const connection = yield DB_1.DB.getInstance().getConnection();
            try {
                const rows = yield booklets_repo_1.default.findByCampaignSessionAndBag(connection, campaignId, sessionId, bagNo);
                return rows.map((r) => ({
                    id: r.booklet_id,
                    sessionId: r.session_id,
                    bagNo: r.bag_no,
                    seqInBag: r.seq_in_bag,
                    status: r.status,
                    userCode: r.user_code,
                    fullName: r.full_name,
                    qrPayload: r.qr_payload,
                }));
            }
            finally {
                connection.release();
            }
        });
    }
}
exports.bagService = bagService;
_a = bagService;
/**
 * [POST] สร้างถุง (Bulk)
 */
bagService.bulkCreate = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const connection = yield DB_1.DB.getInstance().getConnection();
    try {
        yield connection.beginTransaction();
        const bagsToCreateRepo = [];
        const bagsToReturnRedux = [];
        const sessionIdInt = parseInt(payload.sessionId, 10);
        const maxNo = yield bag_repo_1.default.getMaxBagNoForSession(sessionIdInt, connection);
        const startNo = maxNo + 1;
        for (let i = 0; i < payload.count; i++) {
            const bagNoInt = startNo + i;
            const bagIdString = String(bagNoInt);
            // สำหรับ DB
            bagsToCreateRepo.push({
                session_id: sessionIdInt,
                bag_no: bagNoInt,
                count_items: payload.capacity,
                status: "draft",
            });
            // สำหรับ Redux (ฝั่ง frontend)
            bagsToReturnRedux.push({
                id: bagIdString, // "101", "102", ...
                campaignId: payload.campaignId, // "1"
                sessionId: payload.sessionId, // "10" (แบบ string ตามเดิม)
                sessionLabel: payload.sessionLabel,
                capacity: payload.capacity,
                scanned: [],
                status: "draft",
                // ถ้าอยากเก็บเลขจริงแยกด้วยก็เพิ่ม field bagNo: bagNoInt ได้
            });
        }
        yield bag_repo_1.default.bulkCreate(bagsToCreateRepo, connection);
        yield connection.commit();
        return bagsToReturnRedux;
    }
    catch (error) {
        yield connection.rollback();
        console.error("Service Error (Bulk Create Bags):", error);
        throw error;
    }
    finally {
        connection.release();
    }
});
/**
 * [POST] Finalize และ Link Booklets (สมองหลัก)
 */
bagService.InsertBooklets = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const connection = yield DB_1.DB.getInstance().getConnection();
    try {
        yield connection.beginTransaction();
        const campaignIdNum = parseInt(payload.campaignId, 10);
        const bagNo = parseInt(payload.bagId, 10);
        // 1) หา bag จริงใน DB จาก campaign + bag_no
        const bagRow = yield bag_repo_1.default.findByCampaignAndBagNo(connection, campaignIdNum, bagNo);
        if (!bagRow) {
            throw new Error("ไม่พบถุงในแคมเปญนี้");
        }
        console.log(bagRow);
        const bagDbId = bagRow.id;
        const sessionId = Number(bagRow.session_id);
        const results = [];
        let seq = 1;
        for (const qr of payload.scannedCodes) {
            // 2.1 ถอด QR → ได้ { cid, sid, uid }
            const decoded = yield key_service_1.keyService.decryptQrPayload(qr, campaignIdNum);
            // decoded: { cid: number; sid: number; uid: string }
            if (decoded.cid !== campaignIdNum) {
                throw new Error(`QR ไม่ตรงกับแคมเปญ (cid=${decoded.cid}, current=${campaignIdNum})`);
            }
            if (decoded.sid !== sessionId) {
                throw new Error(`QR ไม่ตรงกับ session ของถุงนี้ (sid=${decoded.sid}, sessionId=${sessionId})`);
            }
            // 2.2 หา user_session จาก cid + sid + uid
            const userSession = yield user_session_repo_1.default.findUserSessionByCampaignSessionAndUserCode(connection, {
                campaignId: campaignIdNum,
                sessionId,
                userCode: decoded.uid, // user_code, ไม่ใช่ id
            });
            if (!userSession) {
                throw new Error(`ไม่พบ user_session ของผู้เข้าสอบ ${decoded.uid}`);
            }
            console.log(bagDbId);
            const bookletId = yield booklets_repo_1.default.insertOne(connection, {
                sessionId,
                userSessionId: userSession.id,
                bagNo,
                seqInBag: seq,
                status: "CREATED", // ตามรูปที่คุณใช้ตอนแพ็คถุง
            });
            results.push({
                id: bookletId,
                sessionId,
                bagNo,
                userSessionId: userSession.id,
                seqInBag: seq,
                userCode: userSession.user_code,
            });
            seq++;
        }
        yield connection.commit();
        return results;
    }
    catch (error) {
        yield connection.rollback();
        console.error("Service Error (Finalize & Link):", error);
        throw error;
    }
    finally {
        connection.release();
    }
});
bagService.getAllByCampaignId = (campaignId) => __awaiter(void 0, void 0, void 0, function* () {
    const connection = yield DB_1.DB.getInstance().getConnection();
    try {
        const dbBags = yield bag_repo_1.default.findAllByCampaignId(campaignId, connection);
        const reduxBags = dbBags.map(dbBag => {
            return {
                id: dbBag.bag_no,
                campaignId: dbBag.campaign_id,
                sessionId: dbBag.session_id,
                sessionLabel: dbBag.session_label,
                subjectCode: dbBag.subject_code,
                subjectName: dbBag.subject_name,
                capacity: dbBag.count_items,
                scanned: [],
                status: dbBag.status,
            };
        });
        return reduxBags;
    }
    catch (error) {
        console.error("Service Error (Get All Bags):", error);
        throw error;
    }
    finally {
        connection.release();
    }
});
bagService.deleteById = (bagId) => __awaiter(void 0, void 0, void 0, function* () {
    const connection = yield DB_1.DB.getInstance().getConnection();
    try {
        yield connection.beginTransaction();
        // (TODO: ควรเช็คว่ามี Booklets ในถุงนี้หรือไม่ก่อนลบ)
        // (สมมติว่า Repo ใช้ 'bagId' (String))
        yield bag_repo_1.default.deleteById(bagId, connection);
        yield connection.commit();
        return { bagId: bagId };
    }
    catch (error) {
        yield connection.rollback();
        console.error("Service Error (Delete Bag):", error);
        throw error;
    }
    finally {
        connection.release();
    }
});
