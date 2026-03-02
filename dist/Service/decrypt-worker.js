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
const worker_threads_1 = require("worker_threads");
const key_service_1 = require("./key.service"); // 👈 เช็ค path ให้ตรงกับโปรเจกต์ของคุณ
const campaign_repo_1 = __importDefault(require("../Repo/campaign.repo"));
const key_repo_1 = __importDefault(require("../Repo/key.repo"));
// ตั้งค่าตัวแปรเข้ารหัส (ต้องตรงกับที่ใช้สร้าง QR)
const PAYLOAD_ENCODING = "utf8";
const CIPHER_ENCODING = "base64";
const STATIC_IV_STRING = "encryptionivgodz"; // 16 bytes
const STATIC_IV_BUFFER = Buffer.from(STATIC_IV_STRING, PAYLOAD_ENCODING);
function processDecryption() {
    return __awaiter(this, void 0, void 0, function* () {
        const { booklets, campaign_id } = worker_threads_1.workerData;
        const results = [];
        try {
            // 🛑 1. เช็คสถานะแคมเปญแค่ "ครั้งเดียว"
            const isActiveCamp = yield campaign_repo_1.default.IscampaignActive(campaign_id);
            if (!isActiveCamp)
                throw new Error("Campaign inactive");
            // 🛑 2. ดึงคีย์จาก DB แค่ "ครั้งเดียว"
            const keys = yield key_repo_1.default.findAllByCampaignId(campaign_id);
            if (keys.length !== 2)
                throw new Error("Keys incomplete");
            const [key1, key2] = keys;
            // 🛑 3. ถอดรหัสคีย์ด้วย Master Key แค่ "ครั้งเดียว"
            const decryptedKey1Buffer = (0, key_service_1.aesDecrypt)(Buffer.from(key1.key, CIPHER_ENCODING), Buffer.from(process.env.MASTER_KEY, PAYLOAD_ENCODING), STATIC_IV_BUFFER);
            const decryptedKey2Buffer = (0, key_service_1.aesDecrypt)(Buffer.from(key2.key, CIPHER_ENCODING), Buffer.from(process.env.MASTER_KEY, PAYLOAD_ENCODING), STATIC_IV_BUFFER);
            const key1Buffer = Buffer.from(decryptedKey1Buffer.toString(PAYLOAD_ENCODING), PAYLOAD_ENCODING);
            const key2Buffer = Buffer.from(decryptedKey2Buffer.toString(PAYLOAD_ENCODING), PAYLOAD_ENCODING);
            // 🚀 4. เริ่มวนลูป 6,000 เล่มด้วยความเร็วแสง (ทำแค่คณิตศาสตร์ใน RAM ล้วนๆ)
            for (const b of booklets) {
                // ใช้ decryptFast ที่เราเพิ่งสร้างใหม่ใน key.service.ts
                const decoded = key_service_1.keyService.decryptFast(b.qr_payload, key1Buffer, key2Buffer);
                // รองรับทั้งแบบเก่าและใหม่
                const uid = (decoded === null || decoded === void 0 ? void 0 : decoded.user_code) || (decoded === null || decoded === void 0 ? void 0 : decoded.uid) || (decoded === null || decoded === void 0 ? void 0 : decoded.user_id) || null;
                if (uid) {
                    results.push({ uid: String(uid), qr_payload: b.qr_payload });
                }
            }
            // ส่งผลลัพธ์กลับไปที่ Main Thread ทันที
            worker_threads_1.parentPort === null || worker_threads_1.parentPort === void 0 ? void 0 : worker_threads_1.parentPort.postMessage(results);
        }
        catch (error) {
            console.error("Worker Initialization Failed:", error);
            worker_threads_1.parentPort === null || worker_threads_1.parentPort === void 0 ? void 0 : worker_threads_1.parentPort.postMessage([]); // ส่ง array ว่างกลับไปถ้าพังตั้งแต่ต้น จะได้ไม่ค้าง
        }
    });
}
processDecryption();
