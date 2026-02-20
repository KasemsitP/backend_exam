// services/campaignDecrypt.service.ts
import { DB } from "../model/DB";
import { keyService } from "./key.service";
import bcrypt from "bcrypt";
import { sendMail } from "../utills/mail";
import { emailTemplate } from "../utills/emailtheme";
import crypto from "crypto";
import campaignRepo from "../Repo/campaign.repo";

import decryptRepo from "../Repo/decrypt.repo";
function formatUnlockError(pr: { issues: { code: string; message: string; meta?: any }[] }) {
    // ถ้าอยาก “สั้น” เอาแค่บรรทัดเดียว:
    // return pr.issues.map(i => `- ${i.message}`).join("\n");

return pr.issues
  .map((i) => {
    switch (i.code) {
      case "NO_KEYS":
        return [
          "❌ ยังไม่มีคีย์เข้ารหัส",
          "กรุณาสร้าง/เพิ่มคีย์อย่างน้อย 2 ดอกก่อนปลดล็อก",
        ].join("\n");

      case "NOT_ENOUGH_KEYS":
        return [
          "❌ คีย์เข้ารหัสยังไม่ครบ",
          `ตอนนี้มี ${i.meta?.keyCount ?? "ไม่ทราบ"} ดอก`,
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
          `ยังเหลืออีก ${i.meta?.missingSeat ?? "ไม่ทราบ"} คน ที่ยังไม่มีห้อง/แถว/คอลัมน์`,
          "กรุณาจัดที่นั่งให้ครบก่อนปลดล็อก",
        ].join("\n");

      case "UNBAGGED":
        return [
          "❌ ยังมีเล่มข้อสอบที่ยังไม่ถูกใส่ถุง",
          `ยังเหลือ ${i.meta?.unbagged ?? "ไม่ทราบ"} เล่ม`,
          "กรุณาจัดถุงให้ครบก่อนปลดล็อก",
        ].join("\n");

      case "QUESTION_COUNT_MISMATCH":
        return [
          "❌ จำนวนข้อสอบไม่ตรงกัน",
          `พบ ${i.meta?.mismatchCountTotal ?? "ไม่ทราบ"} วิชา/รอบ ที่จำนวนข้อในระบบไม่สอดคล้องกัน`,
          "กรุณาตรวจให้จำนวนข้อใน Session กับ Subject Questions ตรงกันก่อน",
        ].join("\n");

      case "SLOT_MISSING":
        return [
          "❌ ยังสร้าง Slot การตรวจไม่ครบ",
          `ยังขาด ${i.meta?.missingSlotsTotal ?? "ไม่ทราบ"} slot`,
          "ต้องสร้าง slot ให้ครบทุกเล่ม/ทุกข้อ/ผู้ตรวจ 2 คนก่อนปลดล็อก",
        ].join("\n");

      case "SLOT_NOT_COMPLETED":
        return [
          "❌ ยังตรวจข้อสอบไม่ครบ",
          `ยังเหลือ ${i.meta?.pendingSlots ?? i.meta?.notCompletedTotal ?? "ไม่ทราบ"} slot ที่สถานะยังไม่เสร็จ`,
          "ต้องให้สถานะเป็น COMPLETED ครบก่อนปลดล็อก",
        ].join("\n");

      default:
        return `❌ ${i.message ?? "มีเงื่อนไขบางอย่างยังไม่ผ่าน"}`;
    }
  })
  .join("\n\n"); // ✅ เว้นบรรทัดระหว่างหัวข้อ
}

export class CampaignDecryptService {
    static async decryptedUnlock(campaignId: number, FirstKey: string, SecondKey: string) {
        const conn = await DB.getInstance().getConnection();
        try {
            await conn.beginTransaction();

            const camp = await decryptRepo.getCampaignIdUnlock(campaignId, conn);

            if (!camp) throw new Error("ไม่พบแคมเปญ");
            if (camp.is_unlock === 1) {
                await conn.commit();
                return { success: true, message: "รอบสอบถูกปลดล็อกอยู่แล้ว" };
            }

            const prereq = await decryptRepo.checkUnlockPrerequisites(campaignId, conn);
            if (!prereq.ok) {
                throw new Error("ยังปลดล็อกไม่ได้:\n" + formatUnlockError(prereq));
            }

            const { decryptedKey1, decryptedKey2 } = await keyService.decrypteKeyForUnlock(campaignId, conn);
            if (!decryptedKey1 || !decryptedKey2) throw new Error("ไม่พบคีย์สำหรับแคมเปญนี้");
            if (decryptedKey1 !== FirstKey || decryptedKey2 !== SecondKey) throw new Error("คีย์ที่กรอกไม่ถูกต้อง");

            await campaignRepo.unlockCampaign(campaignId, conn);

            await conn.commit();
            return { success: true, message: "ถอดรหัสปลดล็อครอบสอบสำเร็จ" };
        } catch (error: any) {
            await conn.rollback();
            throw new Error(error.message || "ไม่สามารถถอดรหัสปลดล็อครอบสอบได้");
        } finally {
            conn.release();
        }
    }
}