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
const user_session_repo_1 = __importDefault(require("../Repo/user-session.repo")); // (Import Repo จาก Canvas)
function parseId(id) {
    if (typeof id === "number") {
        return id; // (ถ้าเป็น 1 ➜ 1)
    }
    return parseInt(id.replace(/\D/g, ""));
}
class verifyService {
}
exports.verifyService = verifyService;
_a = verifyService;
verifyService.verifyQrPayload = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const connection = yield DB_1.DB.getInstance().getConnection();
    try {
        // (แปลง ID)
        const campaignIdNumeric = parseId(payload.campaignId);
        const sessionIdNumeric = parseId(payload.sessionId);
        console.log(payload.qrPayload, campaignIdNumeric, " ", sessionIdNumeric);
        // 1. ถอดรหัส (Decrypt)
        const decryptedPayload = yield keyService.keyService.decryptQrPayload(payload.qrPayload, campaignIdNumeric);
        if (!decryptedPayload || !decryptedPayload.uid || !decryptedPayload.sid) {
            throw new Error(`QR Code ไม่ถูกต้อง หรือถอดรหัสล้มเหลว`);
        }
        console.log(decryptedPayload);
        // 2. ⭐️ (ตรวจสอบความปลอดภัย) ⭐️
        // (เช็คว่า QR Code นี้ ตรงกับ Session ที่เจ้าหน้าที่กำลังคุมสอบหรือไม่)
        if (decryptedPayload.sid !== sessionIdNumeric) {
            throw new Error(`QR Code นี้สำหรับ Session อื่น (Expected: ${sessionIdNumeric}, Got: ${decryptedPayload.sid})`);
        }
        // 3. ดึงข้อมูลผู้สอบ (ใช้ฟังก์ชันใน Canvas)
        const userSession = yield user_session_repo_1.default.findByUserCodeAndSessionId(decryptedPayload.uid, decryptedPayload.sid, connection);
        if (!userSession) {
            throw new Error(`ไม่พบข้อมูลผู้สอบ (UserCode: ${decryptedPayload.ucode})`);
        }
        return userSession; // (ส่งข้อมูลผู้สอบกลับไป)
    }
    catch (error) {
        // (ไม่ต้อง Rollback เพราะนี่คือ Read-only)
        console.error("Service Error (Verify QR):", error);
        throw error;
    }
    finally {
        connection.release();
    }
});
