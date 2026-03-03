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
const booklets_repo_1 = __importDefault(require("../Repo/booklets.repo"));
function formatUnlockError(pr) {
    return pr.issues
        .map((i) => {
        var _a;
        switch (i.code) {
            case "NO_SCANNED_DATA":
                return ["❌ ยังไม่มีข้อมูลข้อสอบ", i.message, "ต้องมีการสแกนเล่มข้อสอบลงถุงก่อน"].join("\n");
            case "NO_GRADING_SLOTS":
                return ["❌ ยังไม่ได้สร้างช่องตรวจ", i.message, "ต้องสร้างช่องตรวจให้ครบก่อน"].join("\n");
            case "GRADING_INCOMPLETE":
                return ["❌ กรรมการยังตรวจไม่เสร็จ", i.message, "ต้องตรวจข้อสอบให้เสร็จ 100% (สถานะ COMPLETED) ก่อนปลดล็อก"].join("\n");
            case "SCORE_MISSING":
                return ["❌ ข้อมูลคะแนนสูญหาย", i.message, "กรุณาติดต่อผู้ดูแลระบบเพื่อตรวจสอบความถูกต้องของฐานข้อมูล"].join("\n");
            default:
                return `❌ ${(_a = i.message) !== null && _a !== void 0 ? _a : "มีเงื่อนไขบางอย่างยังไม่ผ่าน"}`;
        }
    })
        .join("\n\n");
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
                console.log("Unlock Prerequisites Check:", prereq);
                if (!prereq.ok) {
                    throw new Error("ยังปลดล็อกไม่ได้:\n" + formatUnlockError(prereq));
                }
                // 💡 [ทางเลือก] ถ้าคุณไม่ได้เก็บคีย์ไว้ใน DB แล้ว สามารถลบ 3 บรรทัดนี้ทิ้งได้เลย 
                // แต่ถ้ายังเก็บไว้เพื่อเอามาเทียบความถูกต้อง (Validate) ก่อนถอดรหัสจริง ก็เก็บไว้ได้ครับ
                // const { decryptedKey1, decryptedKey2 } = await keyService.decrypteKeyForUnlock(campaignId, conn);
                // if (!decryptedKey1 || !decryptedKey2) throw new Error("ไม่พบคีย์สำหรับแคมเปญนี้");
                // if (decryptedKey1 !== FirstKey || decryptedKey2 !== SecondKey) throw new Error("คีย์ที่กรอกไม่ถูกต้อง");
                console.log(`กำลังเริ่มกระบวนการ Unblind สำหรับ Campaign ID: ${campaignId}`);
                // 1. ดึงเล่มข้อสอบ "ทั้งหมด" ใน Campaign นี้ที่ยังไม่ได้เปิดเผย
                const blindBooklets = yield booklets_repo_1.default.findBlindBookletsByCampaign(conn, campaignId);
                if (blindBooklets.length > 0) {
                    try {
                        // 🛑 หมายเหตุ: คุณต้องไปสร้าง/แก้ไขฟังก์ชันนี้ใน keyService ให้รับ FirstKey, SecondKey ด้วยนะครับ
                        yield key_service_1.keyService.decryptQrPayloadWithKeys(blindBooklets[0].qr_payload, FirstKey, SecondKey);
                    }
                    catch (err) {
                        throw new Error("❌ คีย์ที่กรอกไม่สามารถนำไปถอดรหัสข้อสอบได้ กรุณาตรวจสอบคีย์อีกครั้ง");
                    }
                    // 2. ⚡ ถอดรหัสแบบขนาน โดยใช้คีย์ที่กรอกเข้ามาตรงๆ
                    const decryptPromises = blindBooklets.map((b) => __awaiter(this, void 0, void 0, function* () {
                        try {
                            // 🚀 โยนคีย์เข้าไปถอดรหัสตรงๆ เลย
                            const decoded = yield key_service_1.keyService.decryptQrPayloadWithKeys(b.qr_payload, FirstKey, SecondKey);
                            if (b.session_id !== decoded.sid) {
                                throw new Error(`วันที่สอบไม่ตรงกัน เกิดข้อผิดพลาด`);
                            }
                            return {
                                success: true,
                                bookletId: b.id,
                                cid: decoded.cid,
                                userCode: decoded.uid
                            };
                        }
                        catch (err) {
                            return { success: false, bookletId: b.id, qr: b.qr_payload };
                        }
                    }));
                    const decryptedResults = yield Promise.all(decryptPromises);
                    // 3. 🛡️ Error Handling: ดักจับรายการที่พัง
                    const failedItems = decryptedResults.filter(r => !r.success);
                    if (failedItems.length > 0) {
                        const failedIds = failedItems.map(f => f.bookletId).slice(0, 5).join(", ");
                        throw new Error(`❌ ขัดข้องทางข้อมูล: ถอดรหัสไม่ได้จำนวน ${failedItems.length} เล่ม\n` +
                            `(ตัวอย่าง Booklet ID ที่มีปัญหา: ${failedIds})`);
                    }
                    // 4. 📦 เตรียมข้อมูลเพื่ออัปเดต
                    const updates = decryptedResults.map(r => {
                        return {
                            bookletId: Number(r.bookletId),
                            campaignId: Number(r.cid),
                            userCode: String(r.userCode)
                        };
                    });
                    // 5. 🚀 ส่งไป Bulk Update
                    yield booklets_repo_1.default.bulkUpdateUnblindBooklets(conn, updates);
                }
                // อัปเดตสถานะแคมเปญเป็นปลดล็อคแล้ว
                yield campaign_repo_1.default.unlockCampaign(campaignId, conn);
                yield conn.commit();
                return {
                    success: true,
                    message: `ถอดรหัสปลดล็อครอบสอบสำเร็จ (เปิดเผยตัวตนข้อสอบไป ${blindBooklets.length} เล่ม)`
                };
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
