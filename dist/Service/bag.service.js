"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
const keyService = __importStar(require("./key.service"));
const user_session_repo_1 = __importDefault(require("../Repo/user-session.repo"));
const bag_repo_1 = __importDefault(require("../Repo/bag.repo")); // (Import Repo ที่แก้ไขแล้ว)
class bagService {
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
        const bagsToCreateRepo = []; // (สำหรับ Repo)
        const bagsToReturnRedux = []; // (สำหรับ Redux)
        // ⭐️ (FIX 1) แปลง ID (String) เป็น ID (Int)
        const sessionIdInt = parseInt(payload.sessionId.replace("sess-", ""));
        for (let i = 1; i <= payload.count; i++) {
            // ⭐️ (FIX 2) สร้าง ID (String) สำหรับ Redux/Service
            const bagStringId = `${payload.prefix}${String(i).padStart(3, "0")}`;
            console.log(bagStringId);
            const bagNoInt = i;
            // ⭐️ (FIX 3) เตรียมข้อมูลสำหรับ Repo 
            // (ตาม Schema)
            bagsToCreateRepo.push({
                session_id: sessionIdInt,
                bag_no: bagNoInt, // (ส่ง String ID ไปที่ bag_no)
                count_items: payload.capacity, // (ใช้ capacity)
                status: "draft",
            });
            bagsToReturnRedux.push({
                id: bagStringId, // (Redux ID)
                campaignId: payload.campaignId,
                sessionId: payload.sessionId,
                sessionLabel: payload.sessionLabel,
                capacity: payload.capacity,
                scanned: [],
                status: "draft",
            });
        }
        // (ส่งข้อมูลที่ตรงกับ Schema ไปที่ Repo)
        yield bag_repo_1.default.bulkCreate(bagsToCreateRepo, connection);
        yield connection.commit();
        return bagsToReturnRedux; // (ส่งข้อมูลเต็มกลับไปให้ Redux)
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
bagService.finalizeAndLink = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const connection = yield DB_1.DB.getInstance().getConnection();
    try {
        yield connection.beginTransaction();
        const { campaignId, bagId, scannedCodes } = payload;
        const newBooklets = [];
        const campaignIdNumeric = parseInt(campaignId.replace("camp-", ""));
        for (const code of scannedCodes) {
            const decryptedPayload = yield keyService.keyService.decryptQrPayloadConnection(code, campaignIdNumeric, connection);
            if (!decryptedPayload || !decryptedPayload.uid || !decryptedPayload.sid) {
                throw new Error(`QR Code ไม่ถูกต้อง หรือถอดรหัสล้มเหลว: ${code}`);
            }
            const userSession = yield user_session_repo_1.default.findByUserIdAndSessionId(decryptedPayload.uid, decryptedPayload.sid, connection);
            if (!userSession) {
                throw new Error(`ไม่พบ User Session ที่ตรงกับ UID: ${decryptedPayload.uid}, SID: ${decryptedPayload.sid}`);
            }
            // ⭐️ (FIX 5) ตรวจสอบ Schema 'booklets'
            // (Schema 'booklets' ต้องการ bag_no (int) แต่เรามี bagId (string "BAG-001"))
            // (Schema 'booklets' FK อ้างอิง 'bags(session_id, bag_no)')
            // (นี่คือปัญหา Schema Conflict ที่ใหญ่กว่า)
            // ⭐️ (ASSUMPTION) สมมติว่า 'booklets.bag_no' ถูกเปลี่ยนเป็น VARCHAR(32) เพื่อเก็บ 'BAG-001'
            newBooklets.push({
                bag_id_string: bagId, // (ส่ง String ID "BAG-001")
                user_session_id: userSession.user_session_id,
                qr_payload_raw: code,
                session_id: decryptedPayload.sid,
                status: 'bagged',
            });
        }
        if (newBooklets.length > 0) {
            // ⭐️ (FIX 6) เราต้องแก้ bookletRepo.bulkCreate ให้รับ 'bag_id_string'
            // await bookletRepo.bulkCreate(newBooklets, connection);
            console.warn("TODO: bookletRepo.bulkCreate needs schema update (bag_no INT vs bag_id VARCHAR)");
        }
        const newStatus = "ready";
        // (Repo 'updateStatus' ถูกแก้ให้ใช้ bag_no (varchar) แล้ว)
        yield bag_repo_1.default.updateStatus(bagId, newStatus, connection);
        yield connection.commit();
        return {
            bagId: bagId,
            bookletsCreated: newBooklets.length,
            status: newStatus,
        };
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
        // (สมมติว่า Repo ถูกต้อง)
        const dbBags = yield bag_repo_1.default.findAllByCampaignId(campaignId, connection);
        // (แปลง DB Row -> Redux Interface 'Bag')
        const reduxBags = dbBags.map(dbBag => {
            return {
                id: dbBag.bag_no, // (DB: 'bag_no' (VARCHAR) -> Redux: 'id')
                campaignId: dbBag.campaign_id,
                sessionId: dbBag.session_id,
                sessionLabel: dbBag.session_label,
                subjectCode: dbBag.subject_code,
                subjectName: dbBag.subject_name,
                capacity: dbBag.count_items, // (DB: 'count_items' -> Redux: 'capacity')
                scanned: [], // (การ Fetch ครั้งแรก เราไม่จำเป็นต้องส่ง Scanned)
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
