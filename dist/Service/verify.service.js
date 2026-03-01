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
exports.verifyService = void 0;
const DB_1 = require("../model/DB");
const keyService = __importStar(require("./key.service"));
const user_session_repo_1 = __importDefault(require("../Repo/user-session.repo"));
const booklets_repo_1 = __importDefault(require("../Repo/booklets.repo"));
const campaign_repo_1 = __importDefault(require("../Repo/campaign.repo"));
function parseId(id) {
    if (typeof id === "number")
        return id;
    return parseInt(id.replace(/\D/g, ""));
}
class verifyService {
}
exports.verifyService = verifyService;
_a = verifyService;
verifyService.verifyQrPayload = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const connection = yield DB_1.DB.getInstance().getConnection();
    try {
        const campaignIdNumeric = parseId(payload.campaignId);
        const realQrPayload = keyService.keyService.unmaskQrPayload(payload.qrPayload);
        const isActiveCamp = yield campaign_repo_1.default.IscampaignActive(campaignIdNumeric, connection);
        if (!isActiveCamp) {
            throw new Error(`รอบสอบนี้ยังไม่เปิดใช้งาน`);
        }
        const decryptedPayload = yield keyService.keyService.decryptQrPayload(realQrPayload, campaignIdNumeric);
        if (!decryptedPayload || !decryptedPayload.uid || !decryptedPayload.sid) {
            throw new Error(`QR Code ไม่ถูกต้อง หรือถอดรหัสล้มเหลว`);
        }
        if (decryptedPayload.cid !== campaignIdNumeric) {
            throw new Error(`สมุดเล่มนี้อยู่คนละรอบสอบปัจจุบัน กรุณาติดต่อเจ้าหน้าที่`);
        }
        const userSession = yield user_session_repo_1.default.findByUserCodeAndSessionIdForQRcode(decryptedPayload.uid, decryptedPayload.sid, connection);
        if (!userSession) {
            throw new Error(`ไม่พบข้อมูลผู้สอบ (UserCode: ${decryptedPayload.uid})`);
        }
        return Object.assign(Object.assign({}, userSession), { session_id: decryptedPayload.sid });
    }
    catch (error) {
        console.error("Service Error (Verify QR):", error);
        throw error;
    }
    finally {
        connection.release();
    }
});
verifyService.checkBookletsOrders = (campaign_id, qr_payload, booklets_id) => __awaiter(void 0, void 0, void 0, function* () {
    const connection = yield DB_1.DB.getInstance().getConnection();
    try {
        const campaignIdNumeric = parseId(campaign_id);
        const realQrPayload = keyService.keyService.unmaskQrPayload(qr_payload);
        const isActiveCamp = yield campaign_repo_1.default.IscampaignActive(campaignIdNumeric, connection);
        if (!isActiveCamp) {
            throw new Error(`รอบสอบนี้ยังไม่เปิดใช้งาน`);
        }
        const bookletData = yield booklets_repo_1.default.findBookletsbyQRpayloadandBookletsID(connection, realQrPayload, booklets_id);
        if (!bookletData) {
            throw new Error(`ข้อมูลสมุดคำตอบไม่ถูกต้อง หรือไม่มีรายการที่ต้องตรวจสอบเพิ่ม`);
        }
        const userSessionWithExtra = {
            booklets_id: bookletData.random_num,
            subject_name: bookletData.subject_name,
            bag_no: bookletData.bag_no,
        };
        return { success: true, data: userSessionWithExtra };
    }
    catch (error) {
        console.error("Service Error (Check Orders):", error);
        throw error;
    }
    finally {
        connection.release();
    }
});
