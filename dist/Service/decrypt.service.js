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
exports.CampaignDecryptService = void 0;
// services/campaignDecrypt.service.ts
const DB_1 = require("../model/DB");
const key_service_1 = require("./key.service");
const campaign_repo_1 = __importDefault(require("../Repo/campaign.repo"));
const decrypt_repo_1 = __importDefault(require("../Repo/decrypt.repo"));
function formatUnlockError(pr) {
    // ถ้าอยาก “สั้น” เอาแค่บรรทัดเดียว:
    // return pr.issues.map(i => `- ${i.message}`).join("\n");
    return pr.issues
        .map((i) => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
        switch (i.code) {
            case "NO_KEYS":
                return [
                    "❌ ยังไม่มีคีย์เข้ารหัส",
                    "กรุณาสร้าง/เพิ่มคีย์อย่างน้อย 2 ดอกก่อนปลดล็อก",
                ].join("\n");
            case "NOT_ENOUGH_KEYS":
                return [
                    "❌ คีย์เข้ารหัสยังไม่ครบ",
                    `ตอนนี้มี ${(_b = (_a = i.meta) === null || _a === void 0 ? void 0 : _a.keyCount) !== null && _b !== void 0 ? _b : "ไม่ทราบ"} ดอก`,
                    "ต้องมีอย่างน้อย 2 ดอกถึงจะปลดล็อกได้",
                ].join("\n");
            case "NO_IMPORT":
                return [
                    "❌ ยังไม่ได้นำเข้าข้อมูลผู้เข้าสอบ",
                    "กรุณา Import รายชื่อผู้เข้าสอบก่อน",
                ].join("\n");
            case "MISSING_SEAT":
                return [
                    "❌ ยังจัดที่นั่งสอบไม่ครบ",
                    `ยังเหลืออีก ${(_d = (_c = i.meta) === null || _c === void 0 ? void 0 : _c.missingSeat) !== null && _d !== void 0 ? _d : "ไม่ทราบ"} คน ที่ยังไม่มีห้อง/แถว/คอลัมน์`,
                    "กรุณาจัดที่นั่งให้ครบก่อนปลดล็อก",
                ].join("\n");
            case "UNBAGGED":
                return [
                    "❌ ยังมีเล่มข้อสอบที่ยังไม่ถูกใส่ถุง",
                    `ยังเหลือ ${(_f = (_e = i.meta) === null || _e === void 0 ? void 0 : _e.unbagged) !== null && _f !== void 0 ? _f : "ไม่ทราบ"} เล่ม`,
                    "กรุณาจัดถุงให้ครบก่อนปลดล็อก",
                ].join("\n");
            case "QUESTION_COUNT_MISMATCH":
                return [
                    "❌ จำนวนข้อสอบไม่ตรงกัน",
                    `พบ ${(_h = (_g = i.meta) === null || _g === void 0 ? void 0 : _g.mismatchCountTotal) !== null && _h !== void 0 ? _h : "ไม่ทราบ"} วิชา/รอบ ที่จำนวนข้อในระบบไม่สอดคล้องกัน`,
                    "กรุณาตรวจให้จำนวนข้อใน Session กับ Subject Questions ตรงกันก่อน",
                ].join("\n");
            case "SLOT_MISSING":
                return [
                    "❌ ยังสร้าง Slot การตรวจไม่ครบ",
                    `ยังขาด ${(_k = (_j = i.meta) === null || _j === void 0 ? void 0 : _j.missingSlotsTotal) !== null && _k !== void 0 ? _k : "ไม่ทราบ"} slot`,
                    "ต้องสร้าง slot ให้ครบทุกเล่ม/ทุกข้อ/ผู้ตรวจ 2 คนก่อนปลดล็อก",
                ].join("\n");
            case "SLOT_NOT_COMPLETED":
                return [
                    "❌ ยังตรวจข้อสอบไม่ครบ",
                    `ยังเหลือ ${(_p = (_m = (_l = i.meta) === null || _l === void 0 ? void 0 : _l.pendingSlots) !== null && _m !== void 0 ? _m : (_o = i.meta) === null || _o === void 0 ? void 0 : _o.notCompletedTotal) !== null && _p !== void 0 ? _p : "ไม่ทราบ"} slot ที่สถานะยังไม่เสร็จ`,
                    "ต้องให้สถานะเป็น COMPLETED ครบก่อนปลดล็อก",
                ].join("\n");
            default:
                return `❌ ${(_q = i.message) !== null && _q !== void 0 ? _q : "มีเงื่อนไขบางอย่างยังไม่ผ่าน"}`;
        }
    })
        .join("\n\n"); // ✅ เว้นบรรทัดระหว่างหัวข้อ
}
class CampaignDecryptService {
    static decryptedUnlock(campaignId, FirstKey, SecondKey) {
        return __awaiter(this, void 0, void 0, function* () {
            const conn = yield DB_1.DB.getInstance().getConnection();
            try {
                yield conn.beginTransaction();
                const camp = yield decrypt_repo_1.default.getCampaignIdUnlock(campaignId, conn);
                if (!camp)
                    throw new Error("ไม่พบแคมเปญ");
                if (camp.is_unlock === 1) {
                    yield conn.commit();
                    return { success: true, message: "รอบสอบถูกปลดล็อกอยู่แล้ว" };
                }
                const prereq = yield decrypt_repo_1.default.checkUnlockPrerequisites(campaignId, conn);
                if (!prereq.ok) {
                    throw new Error("ยังปลดล็อกไม่ได้:\n" + formatUnlockError(prereq));
                }
                const { decryptedKey1, decryptedKey2 } = yield key_service_1.keyService.decrypteKeyForUnlock(campaignId, conn);
                if (!decryptedKey1 || !decryptedKey2)
                    throw new Error("ไม่พบคีย์สำหรับแคมเปญนี้");
                if (decryptedKey1 !== FirstKey || decryptedKey2 !== SecondKey)
                    throw new Error("คีย์ที่กรอกไม่ถูกต้อง");
                yield campaign_repo_1.default.unlockCampaign(campaignId, conn);
                yield conn.commit();
                return { success: true, message: "ถอดรหัสปลดล็อครอบสอบสำเร็จ" };
            }
            catch (error) {
                yield conn.rollback();
                throw new Error(error.message || "ไม่สามารถถอดรหัสปลดล็อครอบสอบได้");
            }
            finally {
                conn.release();
            }
        });
    }
}
exports.CampaignDecryptService = CampaignDecryptService;
