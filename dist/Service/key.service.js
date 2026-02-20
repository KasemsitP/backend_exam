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
const dashboard_repo_1 = __importDefault(require("../Repo/dashboard.repo"));
const Settings_repo_1 = __importDefault(require("../Repo/Settings.repo"));
//FIX: เปลี่ยนจาก CTR เป็น CBC
const ALGORITHM = "aes-128-cbc";
const PAYLOAD_ENCODING = "utf8";
const CIPHER_ENCODING = "base64";
const IV_LENGTH = 16; // IV ต้องยาว 16 ไบต์ (128 bits)
const STATIC_IV_STRING = "encryptionivgodz"; // 16 bytes
const STATIC_IV_BUFFER = Buffer.from(STATIC_IV_STRING, PAYLOAD_ENCODING);
function aesEncrypt(textBuffer, key, iv) {
    if (iv.length !== IV_LENGTH) {
        console.error(`IV length is ${iv.length}, expected ${IV_LENGTH}`);
        throw new Error("IV ต้องมีความยาว 16 ไบต์ (128 bits) สำหรับ AES-128");
    }
    if (key.length !== 16) {
        console.error(`Key length is ${key.length}, expected 16`);
        throw new Error("คีย์ต้องมีความยาว 16 ไบต์ (128 bits) สำหรับ AES-128");
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
keyService.create = (campaignId, key, account_id, order_num) => __awaiter(void 0, void 0, void 0, function* () {
    if (Buffer.from(key, PAYLOAD_ENCODING).length !== 16) {
        throw new Error("คีย์ต้องมีความยาว 16 ตัวอักษร (128 bits) สำหรับ AES-128");
    }
    const connection = yield DB_1.DB.getInstance().getConnection();
    try {
        yield connection.beginTransaction();
        const count = yield key_repo_1.default.countByCampaignId(campaignId, connection);
        if (count >= 2) {
            throw new Error("คีย์สำหรับรอบสอบนี้มีครบแล้ว (2 คีย์)");
        }
        const checkRole = yield key_repo_1.default.checkRoles(account_id, connection);
        if (!checkRole || checkRole.code !== "MANAGER") {
            throw new Error("คุณไม่มีสิทธิ์ในการสร้างคีย์นี้เนื่องจากคุณไม่ใช่ผู้จัดการคีย์");
        }
        const is_assigned = yield key_repo_1.default.isAssigned(account_id, campaignId, connection);
        if (is_assigned) {
            throw new Error("คุณได้เคยสร้างคีย์สำหรับการเข้ารหัสรอบนี้แล้ว ไม่สามารถสร้างใหม่ได้อีก");
        }
        const order = count;
        console.log(order);
        // if (Number(order) == 0) {
        //     order_num = 1;
        // }
        // else {
        //     order_num = 2;
        // }
        const iv1Buffer = STATIC_IV_BUFFER;
        const key1Buffer = Buffer.from(process.env.MASTER_KEY, PAYLOAD_ENCODING);
        const plainTextBuffer = Buffer.from(key, PAYLOAD_ENCODING);
        const step1 = aesEncrypt(plainTextBuffer, key1Buffer, iv1Buffer);
        const newKey = yield key_repo_1.default.create({
            campaign_id: campaignId,
            // key: key,
            key: step1.toString(CIPHER_ENCODING),
            account_id: account_id,
            iv: STATIC_IV_STRING,
            algor: ALGORITHM,
            order_num: order_num
        }, connection);
        const decryptedBuffer = aesDecrypt(step1, key1Buffer, iv1Buffer);
        const decryptedKey = decryptedBuffer.toString(PAYLOAD_ENCODING);
        console.log("Decrypted Key for verification:", decryptedKey);
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
keyService.delete = (keyId, campaignId, accountId) => __awaiter(void 0, void 0, void 0, function* () {
    const conn = yield DB_1.DB.getInstance().getConnection();
    try {
        yield conn.beginTransaction();
        const checkRole = yield key_repo_1.default.checkRoles(accountId, conn);
        if (!checkRole || checkRole.code !== "MANAGER") {
            throw new Error("คุณไม่มีสิทธิ์ในการลบคีย์นี้เนื่องจากคุณไม่ใช่ผู้จัดการคีย์");
        }
        const keyData = yield key_repo_1.default.findKeys(keyId, campaignId, conn);
        if (!keyData) {
            throw new Error("ไม่พบคีย์ที่ต้องการลบ");
        }
        if (keyData.account_id !== accountId) {
            throw new Error("คุณไม่มีสิทธิ์ในการลบคีย์นี้เนื่องจากคุณไม่ได้เป็นเจ้าของคีย์");
        }
        yield key_repo_1.default.delete(keyId, conn);
        yield conn.commit();
        return true;
    }
    catch (error) {
        yield conn.rollback();
        throw error;
    }
    finally {
        conn.release();
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
keyService.getAllForCampaignManager = (campaignId, AccountId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        return yield key_repo_1.default.findAllByCampaignIdByManager(campaignId, AccountId);
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
keyService.runBulkEncryptionForSession = (campaignId) => __awaiter(void 0, void 0, void 0, function* () {
    const countkeys = yield key_repo_1.default.countByCampaignId(campaignId);
    if (countkeys < 1) {
        throw new Error("ไม่สามารถทำการเข้ารหัสได้เนื่องจากรอบสอบนี้มีคีย์ไม่ครบ 2 คีย์");
    }
    const connection = yield DB_1.DB.getInstance().getConnection();
    let usersEncrypted = 0;
    try {
        yield connection.beginTransaction();
        const sessionRows = yield key_repo_1.default.selectSessionIdByCampaign(campaignId, connection);
        // แปลงเป็น number[]
        const sessionIds = sessionRows.map(s => s.id);
        // 1. ดึงคีย์
        const keys = yield key_repo_1.default.findAllByCampaignId(campaignId, connection);
        if (keys.length !== 2) {
            throw new Error("ไม่สามารถทำการเข้ารหัสได้เนื่องจากรอบสอบนี้มีคีย์ไม่ครบ 2 คีย์");
        }
        const keyFirst = keys.find(k => k.order_num === 1);
        const keySecond = keys.find(k => k.order_num === 2);
        console.log(keyFirst, keySecond);
        if (!keyFirst || !keySecond) {
            throw new Error("คีย์สำหรับรอบสอบนี้ไม่ครบ 2 คีย์");
        }
        const decryptedKey1Buffer = aesDecrypt(Buffer.from(keyFirst.key, CIPHER_ENCODING), Buffer.from(process.env.MASTER_KEY, PAYLOAD_ENCODING), STATIC_IV_BUFFER);
        const decryptedKey1 = decryptedKey1Buffer.toString(PAYLOAD_ENCODING);
        console.log("Decrypted Key 1 for verification:", decryptedKey1);
        const decryptedKey2Buffer = aesDecrypt(Buffer.from(keySecond.key, CIPHER_ENCODING), Buffer.from(process.env.MASTER_KEY, PAYLOAD_ENCODING), STATIC_IV_BUFFER);
        const decryptedKey2 = decryptedKey2Buffer.toString(PAYLOAD_ENCODING);
        console.log("Decrypted Key 2 for verification:", decryptedKey2);
        console.log(campaignId);
        // const [key1, key2] = keys;
        const key1Buffer = Buffer.from(decryptedKey1, PAYLOAD_ENCODING);
        const key2Buffer = Buffer.from(decryptedKey2, PAYLOAD_ENCODING);
        // Static IV Buffer ที่กำหนดไว้
        const iv1Buffer = STATIC_IV_BUFFER;
        const iv2Buffer = STATIC_IV_BUFFER; // (ใช้ตัวเดียวกันสำหรับ Layer 2 ตามโค้ด Demo)
        for (const sessionId of sessionIds) {
            const allUserLinks = yield importuser_repo_1.default.findAllUserLinksForSession(sessionId, connection);
            if (allUserLinks.length === 0) {
                console.warn(`No users found for session ${sessionId}`);
                throw new Error(`users in some session not imported yet ${sessionId}`);
            }
            console.log(`Encrypting ${allUserLinks.length} users for session ${sessionId}`);
            for (const userLink of allUserLinks) {
                const payload = {
                    cid: campaignId,
                    sid: sessionId,
                    uid: userLink.user_id,
                };
                const plainTextBuffer = Buffer.from(JSON.stringify(payload), PAYLOAD_ENCODING);
                const step1 = aesEncrypt(plainTextBuffer, key1Buffer, iv1Buffer);
                const step2 = aesEncrypt(step1, key2Buffer, iv2Buffer);
                const finalCiphertext = step2.toString(CIPHER_ENCODING);
                yield importuser_repo_1.default.updateQrPayload(userLink.user_session_id, finalCiphertext, connection);
                usersEncrypted++;
            }
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
keyService.decryptQrPayload = (ciphertext, campaignId) => __awaiter(void 0, void 0, void 0, function* () {
    let flag_qr_inactive = false;
    try {
        const isQrActive = yield Settings_repo_1.default.QRStatus(campaignId);
        if (!isQrActive) {
            flag_qr_inactive = true;
            throw new Error("ไม่สามารถสแกนได้เนื่องจากระบบสแกนคิวอาร์โค้ดถูกปิดใช้งานอยู่");
        }
        console.log("QR Status:", isQrActive);
        // 1. ดึงคีย์ (เหมือนเดิม)
        const keys = yield key_repo_1.default.findAllByCampaignId(campaignId);
        if (keys.length !== 2) {
            throw new Error("ไม่สามารถถอดรหัสได้ เนื่องจากรอบสอบนี้ต้องมีคีย์ทั้งหมด 2 คีย์");
        }
        const [key1, key2] = keys;
        // 2.  FIX: แปลง "Key" (16 ตัวอักษร) เป็น Buffer (16 ไบต์)
        // const key1Buffer = Buffer.from(key1.key, PAYLOAD_ENCODING);
        // const key2Buffer = Buffer.from(key2.key, PAYLOAD_ENCODING);
        //  FIX: ใช้ Static IVs
        const iv1Buffer = STATIC_IV_BUFFER;
        const iv2Buffer = STATIC_IV_BUFFER;
        const decryptedKey1Buffer = aesDecrypt(Buffer.from(key1.key, CIPHER_ENCODING), Buffer.from(process.env.MASTER_KEY, PAYLOAD_ENCODING), STATIC_IV_BUFFER);
        const decryptedKey2Buffer = aesDecrypt(Buffer.from(key2.key, CIPHER_ENCODING), Buffer.from(process.env.MASTER_KEY, PAYLOAD_ENCODING), STATIC_IV_BUFFER);
        const key1Buffer = Buffer.from(decryptedKey1Buffer.toString(PAYLOAD_ENCODING), PAYLOAD_ENCODING);
        const key2Buffer = Buffer.from(decryptedKey2Buffer.toString(PAYLOAD_ENCODING), PAYLOAD_ENCODING);
        console.log(decryptedKey1Buffer.toString(PAYLOAD_ENCODING), decryptedKey2Buffer.toString(PAYLOAD_ENCODING));
        // 3.  FIX: แปลง Ciphertext (ไม่ต้องแยก IV)
        const cipherBuffer = Buffer.from(ciphertext, CIPHER_ENCODING);
        // 4.  DOUBLE DECRYPTION (ใช้ Static IVs)
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
        if (flag_qr_inactive) {
            throw new Error("ไม่สามารถสแกนได้เนื่องจากระบบสแกนคิวอาร์โค้ดถูกปิดใช้งานอยู่");
        }
        throw new Error("ไม่สามารถถอดรหัสได้ เนื่องจากข้อมูลไม่ถูกต้องหรือคีย์ไม่ครบถ้วน");
    }
});
keyService.decrypteKeyForUnlock = (campaignId, connection) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const keys = yield key_repo_1.default.findAllByCampaignId(campaignId, connection);
        if (keys.length < 2) {
            throw new Error("รอบสอบนี้ยังไม่ได้สร้างคีย์ครับ 2 คีย์");
        }
        const keyFirst = keys.find(k => k.order_num === 1);
        const keySecond = keys.find(k => k.order_num === 2);
        if (!keyFirst || !keySecond) {
            throw new Error("คีย์สำหรับรอบสอบนี้ไม่ครบ 2 คีย์");
        }
        const decryptedKey1Buffer = aesDecrypt(Buffer.from(keyFirst.key, CIPHER_ENCODING), Buffer.from(process.env.MASTER_KEY, PAYLOAD_ENCODING), STATIC_IV_BUFFER);
        const decryptedKey1 = decryptedKey1Buffer.toString(PAYLOAD_ENCODING);
        console.log("Decrypted Key 1 for verification:", decryptedKey1);
        const decryptedKey2Buffer = aesDecrypt(Buffer.from(keySecond.key, CIPHER_ENCODING), Buffer.from(process.env.MASTER_KEY, PAYLOAD_ENCODING), STATIC_IV_BUFFER);
        const decryptedKey2 = decryptedKey2Buffer.toString(PAYLOAD_ENCODING);
        console.log("Decrypted Key 2 for verification:", decryptedKey2);
        return { decryptedKey1, decryptedKey2 };
    }
    catch (error) {
        console.error("Service Error (Decryption for Unlock):", error);
        throw new Error("ถอดรหัสล้มเหลว");
    }
});
keyService.decryptQrPayloadConnection = (ciphertext, campaignId, connection) => __awaiter(void 0, void 0, void 0, function* () {
    let flag_qr_inactive = false;
    try {
        const isQrActive = yield Settings_repo_1.default.QRStatus(campaignId, connection);
        if (!isQrActive) {
            flag_qr_inactive = true;
            throw new Error("ไม่สามารถสแกนได้เนื่องจากระบบสแกนคิวอาร์โค้ดถูกปิดใช้งานอยู่");
        }
        console.log("QR Status:", isQrActive);
        // 1. ดึงคีย์ (เหมือนเดิม)
        const keys = yield key_repo_1.default.findAllByCampaignId(campaignId, connection);
        if (keys.length !== 2) {
            throw new Error("ไม่สามารถถอดรหัสได้ เนื่องจากรอบสอบนี้ต้องมีคีย์ทั้งหมด 2 คีย์");
        }
        const [key1, key2] = keys;
        // 2.  FIX: แปลง "Key" (16 ตัวอักษร) เป็น Buffer (16 ไบต์)
        // const key1Buffer = Buffer.from(key1.key, PAYLOAD_ENCODING);
        // const key2Buffer = Buffer.from(key2.key, PAYLOAD_ENCODING);
        //  FIX: ใช้ Static IVs
        const iv1Buffer = STATIC_IV_BUFFER;
        const iv2Buffer = STATIC_IV_BUFFER;
        const decryptedKey1Buffer = aesDecrypt(Buffer.from(key1.key, CIPHER_ENCODING), Buffer.from(process.env.MASTER_KEY, PAYLOAD_ENCODING), STATIC_IV_BUFFER);
        const decryptedKey2Buffer = aesDecrypt(Buffer.from(key2.key, CIPHER_ENCODING), Buffer.from(process.env.MASTER_KEY, PAYLOAD_ENCODING), STATIC_IV_BUFFER);
        const key1Buffer = Buffer.from(decryptedKey1Buffer.toString(PAYLOAD_ENCODING), PAYLOAD_ENCODING);
        const key2Buffer = Buffer.from(decryptedKey2Buffer.toString(PAYLOAD_ENCODING), PAYLOAD_ENCODING);
        console.log(decryptedKey1Buffer.toString(PAYLOAD_ENCODING), decryptedKey2Buffer.toString(PAYLOAD_ENCODING));
        // 3.  FIX: แปลง Ciphertext (ไม่ต้องแยก IV)
        const cipherBuffer = Buffer.from(ciphertext, CIPHER_ENCODING);
        // 4.  DOUBLE DECRYPTION (ใช้ Static IVs)
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
        if (flag_qr_inactive) {
            throw new Error("ไม่สามารถสแกนได้เนื่องจากระบบสแกนคิวอาร์โค้ดถูกปิดใช้งานอยู่");
        }
        throw new Error("ไม่สามารถถอดรหัสได้ เนื่องจากข้อมูลไม่ถูกต้องหรือคีย์ไม่ครบถ้วน");
    }
});
keyService.GetDashBoard = (campaign_id) => __awaiter(void 0, void 0, void 0, function* () {
    var _b, _c, _d, _e, _f, _g, _h, _j;
    const importStatus = yield dashboard_repo_1.default.getStatusSession(Number(campaign_id));
    const encryptedStatus = yield dashboard_repo_1.default.getIsEncrypted(Number(campaign_id));
    const subjectsQuestions = yield dashboard_repo_1.default.getSubjectQuestionsByCampaign(Number(campaign_id));
    const sessionDates = yield key_repo_1.default.GetSessionDate(Number(campaign_id)); // << ควรมี session_id + session_code
    const keyStatus = yield key_repo_1.default.KeyStatus(Number(campaign_id));
    // --- helper ---
    const toNumber = (v, fallback = 0) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : fallback;
    };
    // ทำ index หา session ได้เร็ว
    const sessionDateMap = new Map();
    for (const d of sessionDates !== null && sessionDates !== void 0 ? sessionDates : []) {
        sessionDateMap.set(d.session_id, d);
    }
    // เผื่อ sessionDates ไม่มี session_code ให้ดึงจาก importStatus
    const sessionCodeMap = new Map();
    for (const s of importStatus !== null && importStatus !== void 0 ? importStatus : []) {
        sessionCodeMap.set(s.session_id, s.session_code);
    }
    // --- GROUP: session -> subjects -> questions ---
    const sessions = {};
    for (const r of subjectsQuestions !== null && subjectsQuestions !== void 0 ? subjectsQuestions : []) {
        const sid = Number(r.session_id);
        const subjId = Number(r.subject_id);
        if (!sessions[sid]) {
            const d = sessionDateMap.get(sid);
            sessions[sid] = {
                session_id: sid,
                session_code: (_c = (_b = d === null || d === void 0 ? void 0 : d.session_code) !== null && _b !== void 0 ? _b : sessionCodeMap.get(sid)) !== null && _c !== void 0 ? _c : `Session ${sid}`,
                exam_date: (_e = (_d = d === null || d === void 0 ? void 0 : d.exam_date) !== null && _d !== void 0 ? _d : r.exam_date) !== null && _e !== void 0 ? _e : null,
                start_at: (_g = (_f = d === null || d === void 0 ? void 0 : d.start_at) !== null && _f !== void 0 ? _f : r.start_at) !== null && _g !== void 0 ? _g : null,
                end_at: (_j = (_h = d === null || d === void 0 ? void 0 : d.end_at) !== null && _h !== void 0 ? _h : r.end_at) !== null && _j !== void 0 ? _j : null,
                subjects: [],
            };
        }
        let subj = sessions[sid].subjects.find((x) => x.subject_id === subjId);
        if (!subj) {
            subj = {
                subject_id: subjId,
                subject_code: r.subject_code,
                subject_name: r.subject_name,
                questions: [],
            };
            sessions[sid].subjects.push(subj);
        }
        subj.questions.push({
            id: Number(r.subject_question_id),
            questionNo: Number(r.question_no),
            label: r.question_label,
            maxScore: toNumber(r.max_score, 0),
        });
    }
    // sort ให้เรียงสวย
    Object.values(sessions).forEach((sess) => {
        sess.subjects.forEach((subj) => {
            subj.questions.sort((a, b) => a.questionNo - b.questionNo);
        });
        sess.subjects.sort((a, b) => String(a.subject_code).localeCompare(String(b.subject_code)));
    });
    return {
        importStatus,
        encryptedStatus,
        keyStatus,
        sessionDates, // จะคงไว้ก็ได้
        subjectsQuestions, // จะคงไว้ก็ได้ (ไว้ debug)
        sessions, // ✅ ตัวใหม่ที่ UI ใช้ง่ายสุด
    };
});
