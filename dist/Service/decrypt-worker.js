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
const key_service_1 = require("./key.service");
const campaign_repo_1 = __importDefault(require("../Repo/campaign.repo"));
const key_repo_1 = __importDefault(require("../Repo/key.repo"));
const PAYLOAD_ENCODING = "utf8";
const CIPHER_ENCODING = "base64";
function processDecryption() {
    return __awaiter(this, void 0, void 0, function* () {
        const { booklets, campaign_id } = worker_threads_1.workerData;
        const results = [];
        try {
            // 1. เช็คสถานะแคมเปญครั้งเดียว
            const isActiveCamp = yield campaign_repo_1.default.IscampaignActive(campaign_id);
            if (!isActiveCamp)
                throw new Error("Campaign inactive");
            // 2. ดึงคีย์จาก DB ครั้งเดียว
            const keys = yield key_repo_1.default.findAllByCampaignId(campaign_id);
            if (keys.length !== 2)
                throw new Error("Keys incomplete");
            const keyFirst = keys.find((k) => k.order_num === 1);
            const keySecond = keys.find((k) => k.order_num === 2);
            if (!keyFirst || !keySecond) {
                throw new Error("Keys incomplete");
            }
            // 3. ถอดรหัส campaign keys ด้วย MASTER_KEY ครั้งเดียว
            const masterKeyBuffer = Buffer.from(process.env.MASTER_KEY || "", PAYLOAD_ENCODING);
            if (masterKeyBuffer.length !== 16) {
                throw new Error("MASTER_KEY must be 16 bytes for AES-128-GCM");
            }
            const decryptedKey1Buffer = (0, key_service_1.aesDecrypt)(Buffer.from(keyFirst.key, CIPHER_ENCODING), masterKeyBuffer);
            const decryptedKey2Buffer = (0, key_service_1.aesDecrypt)(Buffer.from(keySecond.key, CIPHER_ENCODING), masterKeyBuffer);
            const key1Buffer = Buffer.from(decryptedKey1Buffer.toString(PAYLOAD_ENCODING), PAYLOAD_ENCODING);
            const key2Buffer = Buffer.from(decryptedKey2Buffer.toString(PAYLOAD_ENCODING), PAYLOAD_ENCODING);
            if (key1Buffer.length !== 16) {
                throw new Error("Campaign key 1 must be 16 bytes");
            }
            if (key2Buffer.length !== 16) {
                throw new Error("Campaign key 2 must be 16 bytes");
            }
            // 4. วนถอดรหัส booklets ใน RAM
            for (const b of booklets) {
                const decoded = key_service_1.keyService.decryptFast(b.qr_payload, key1Buffer, key2Buffer);
                const uid = (decoded === null || decoded === void 0 ? void 0 : decoded.user_code) ||
                    (decoded === null || decoded === void 0 ? void 0 : decoded.uid) ||
                    (decoded === null || decoded === void 0 ? void 0 : decoded.user_id) ||
                    null;
                if (uid) {
                    results.push({
                        uid: String(uid),
                        qr_payload: b.qr_payload,
                    });
                }
            }
            worker_threads_1.parentPort === null || worker_threads_1.parentPort === void 0 ? void 0 : worker_threads_1.parentPort.postMessage(results);
        }
        catch (error) {
            console.error("Worker Initialization Failed:", error);
            worker_threads_1.parentPort === null || worker_threads_1.parentPort === void 0 ? void 0 : worker_threads_1.parentPort.postMessage([]);
        }
    });
}
processDecryption();
