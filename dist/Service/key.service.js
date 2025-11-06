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
exports.keyService = void 0;
const DB_1 = require("../model/DB");
const key_repo_1 = __importDefault(require("../Repo/key.repo"));
const crypto_1 = __importDefault(require("crypto"));
const importuser_repo_1 = __importDefault(require("../Repo/importuser.repo"));
// ⭐️ FIX: เปลี่ยนจาก CTR เป็น CBC
const ALGORITHM = "aes-128-cbc";
const PAYLOAD_ENCODING = "utf8";
const CIPHER_ENCODING = "base64";
const IV_LENGTH = 16; // IV ต้องยาว 16 ไบต์ (128 bits)
const STATIC_IV_STRING = "encryptionivgodz"; // 16 bytes
const STATIC_IV_BUFFER = Buffer.from(STATIC_IV_STRING, PAYLOAD_ENCODING);
function aesEncrypt(textBuffer, key, iv) {
    if (iv.length !== IV_LENGTH) {
        console.error(`IV length is ${iv.length}, expected ${IV_LENGTH}`);
        throw new Error("Invalid IV length passed to aesEncrypt.");
    }
    if (key.length !== 16) {
        console.error(`Key length is ${key.length}, expected 16`);
        throw new Error("Invalid Key length passed to aesEncrypt (must be 16 bytes for AES-128).");
    }
    const cipher = crypto_1.default.createCipheriv(ALGORITHM, key, iv);
    return Buffer.concat([cipher.update(textBuffer), cipher.final()]);
}
function aesDecrypt(cipherBuffer, key, iv) {
    // ตรวจสอบ IV length เพื่อ Debug
    if (iv.length !== IV_LENGTH) {
        console.error(`IV length is ${iv.length}, expected ${IV_LENGTH}`);
        throw new Error("Invalid IV length passed to aesDecrypt.");
    }
    if (key.length !== 16) {
        console.error(`Key length is ${key.length}, expected 16`);
        throw new Error("Invalid Key length passed to aesDecrypt (must be 16 bytes for AES-128).");
    }
    const decipher = crypto_1.default.createDecipheriv(ALGORITHM, key, iv);
    return Buffer.concat([decipher.update(cipherBuffer), decipher.final()]);
}
class keyService {
}
exports.keyService = keyService;
_a = keyService;
keyService.create = (campaignId, key) => __awaiter(void 0, void 0, void 0, function* () {
    if (Buffer.from(key, PAYLOAD_ENCODING).length !== 16) {
        throw new Error("Key must be exactly 16 characters (16 bytes).");
    }
    const connection = yield DB_1.DB.getInstance().getConnection();
    try {
        yield connection.beginTransaction();
        const count = yield key_repo_1.default.countByCampaignId(campaignId, connection);
        if (count >= 2) {
            throw new Error("Key limit (2) reached for this campaign.");
        }
        const newKey = yield key_repo_1.default.create({
            campaign_id: campaignId,
            key: key,
            iv: STATIC_IV_STRING,
            algor: ALGORITHM,
        }, connection);
        yield connection.commit();
        return newKey;
    }
    catch (error) {
        yield connection.rollback();
        console.error("Service Error (Key Create):", error);
        throw error;
    }
    finally {
        connection.release();
    }
});
/**
 * [ 2. Logic "Delete" (เหมือนเดิม) ]
 */
keyService.delete = (keyId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        return yield key_repo_1.default.delete(keyId);
    }
    catch (error) {
        console.error("Service Error (Key Delete):", error);
        throw error;
    }
});
/**
 * [ 3. Logic "Get" (เหมือนเดิม) ]
 */
keyService.getAllForCampaign = (campaignId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        return yield key_repo_1.default.findAllByCampaignId(campaignId);
    }
    catch (error) {
        console.error("Service Error (Key Get):", error);
        throw error;
    }
});
keyService.getPrerequisites = (campaignId) => __awaiter(void 0, void 0, void 0, function* () {
    const [keyCount, userCount] = yield Promise.all([
        key_repo_1.default.countByCampaignId(campaignId),
        importuser_repo_1.default.countByCampaignId(campaignId),
    ]);
    return {
        hasTwoKeys: keyCount === 2,
        hasImportedUsers: userCount > 0,
    };
});
keyService.runBulkEncryptionForSession = (campaignId, sessionId) => __awaiter(void 0, void 0, void 0, function* () {
    const connection = yield DB_1.DB.getInstance().getConnection();
    let usersEncrypted = 0;
    try {
        yield connection.beginTransaction();
        // 1. ดึงคีย์
        const keys = yield key_repo_1.default.findAllByCampaignId(campaignId, connection);
        if (keys.length !== 2) {
            throw new Error("Key check failed: Campaign must have exactly 2 keys.");
        }
        const [key1, key2] = keys;
        const key1Buffer = Buffer.from(key1.key, PAYLOAD_ENCODING);
        const key2Buffer = Buffer.from(key2.key, PAYLOAD_ENCODING);
        // Static IV Buffer ที่กำหนดไว้
        const iv1Buffer = STATIC_IV_BUFFER;
        const iv2Buffer = STATIC_IV_BUFFER; // (ใช้ตัวเดียวกันสำหรับ Layer 2 ตามโค้ด Demo)
        // 3. ดึงข้อมูล User
        const allUserLinks = yield importuser_repo_1.default.findAllUserLinksForSession(sessionId, connection);
        if (allUserLinks.length === 0) {
            throw new Error("User list check failed: No users found in this session.");
        }
        console.log(allUserLinks);
        for (const userLink of allUserLinks) {
            const payload = {
                cid: campaignId,
                sid: sessionId,
                uid: userLink.user_id,
            };
            console.log(payload);
            const plainTextBuffer = Buffer.from(JSON.stringify(payload), PAYLOAD_ENCODING);
            // ⭐️ 5. (FIX) เข้ารหัสโดยใช้ Static IVs
            const step1 = aesEncrypt(plainTextBuffer, key1Buffer, iv1Buffer);
            console.log("Step 1 Encrypted Buffer:", step1.toString('base64'));
            const step2 = aesEncrypt(step1, key2Buffer, iv2Buffer);
            console.log("Step 2 Encrypted Buffer:", step2.toString('base64'));
            // ⭐️ 6. (FIX) เก็บเฉพาะ Ciphertext (ไม่ต้องเก็บ IV)
            const finalCiphertext = step2.toString(CIPHER_ENCODING);
            yield importuser_repo_1.default.updateQrPayload(userLink.user_session_id, finalCiphertext, connection);
            usersEncrypted++;
        }
        yield connection.commit();
        return { usersEncrypted };
    }
    catch (error) {
        yield connection.rollback();
        console.error("Service Error (Bulk Encryption):", error);
        throw error;
    }
    finally {
        connection.release();
    }
});
/**
 * [ ⭐️ FIX: (Decrypt) ⭐️ ]
 * แก้ไขให้ใช้ Static IV
 */
keyService.decryptQrPayload = (ciphertext, campaignId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // 1. ดึงคีย์ (เหมือนเดิม)
        const keys = yield key_repo_1.default.findAllByCampaignId(campaignId);
        if (keys.length !== 2) {
            throw new Error("Decryption failed: Campaign must have exactly 2 keys.");
        }
        const [key1, key2] = keys;
        // 2. ⭐️ FIX: แปลง "Key" (16 ตัวอักษร) เป็น Buffer (16 ไบต์)
        const key1Buffer = Buffer.from(key1.key, PAYLOAD_ENCODING);
        const key2Buffer = Buffer.from(key2.key, PAYLOAD_ENCODING);
        // ⭐️ FIX: ใช้ Static IVs
        const iv1Buffer = STATIC_IV_BUFFER;
        const iv2Buffer = STATIC_IV_BUFFER;
        // 3. ⭐️ FIX: แปลง Ciphertext (ไม่ต้องแยก IV)
        const cipherBuffer = Buffer.from(ciphertext, CIPHER_ENCODING);
        // 4. ⭐️ DOUBLE DECRYPTION (ใช้ Static IVs)
        // 4.1 Decrypt Layer 2
        const step1DecryptedBuffer = aesDecrypt(cipherBuffer, key2Buffer, iv2Buffer);
        // 4.2 Decrypt Layer 1
        const finalDecryptedBuffer = aesDecrypt(step1DecryptedBuffer, key1Buffer, iv1Buffer);
        // 5. แปลงกลับเป็น String และ JSON
        const plainTextJsonString = finalDecryptedBuffer.toString(PAYLOAD_ENCODING);
        // 6. ตรวจสอบและคืนค่า
        const payload = JSON.parse(plainTextJsonString);
        return payload;
    }
    catch (error) {
        console.error("Service Error (Decryption):", error);
        throw new Error("Decryption failed. Invalid payload or keys.");
    }
});
keyService.decryptQrPayloadConnection = (ciphertext, campaignId, connection) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // 1. ดึงคีย์ (เหมือนเดิม)
        const keys = yield key_repo_1.default.findAllByCampaignId(campaignId);
        if (keys.length !== 2) {
            throw new Error("Decryption failed: Campaign must have exactly 2 keys.");
        }
        const [key1, key2] = keys;
        // 2. ⭐️ FIX: แปลง "Key" (16 ตัวอักษร) เป็น Buffer (16 ไบต์)
        const key1Buffer = Buffer.from(key1.key, PAYLOAD_ENCODING);
        const key2Buffer = Buffer.from(key2.key, PAYLOAD_ENCODING);
        // ⭐️ FIX: ใช้ Static IVs
        const iv1Buffer = STATIC_IV_BUFFER;
        const iv2Buffer = STATIC_IV_BUFFER;
        // 3. ⭐️ FIX: แปลง Ciphertext (ไม่ต้องแยก IV)
        const cipherBuffer = Buffer.from(ciphertext, CIPHER_ENCODING);
        // 4. ⭐️ DOUBLE DECRYPTION (ใช้ Static IVs)
        // 4.1 Decrypt Layer 2
        const step1DecryptedBuffer = aesDecrypt(cipherBuffer, key2Buffer, iv2Buffer);
        // 4.2 Decrypt Layer 1
        const finalDecryptedBuffer = aesDecrypt(step1DecryptedBuffer, key1Buffer, iv1Buffer);
        // 5. แปลงกลับเป็น String และ JSON
        const plainTextJsonString = finalDecryptedBuffer.toString(PAYLOAD_ENCODING);
        // 6. ตรวจสอบและคืนค่า
        const payload = JSON.parse(plainTextJsonString);
        return payload;
    }
    catch (error) {
        console.error("Service Error (Decryption):", error);
        throw new Error("Decryption failed. Invalid payload or keys.");
    }
});
