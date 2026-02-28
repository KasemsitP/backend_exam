// services/campaignDecrypt.service.ts
import { DB } from "../model/DB";
import { keyService } from "./key.service";
import campaignRepo from "../Repo/campaign.repo";
import decryptRepo from "../Repo/decrypt.repo";
import bookletsRepo from "../Repo/booklets.repo";

function formatUnlockError(pr: { issues: { code: string; message: string; meta?: any }[] }) {
  return pr.issues
    .map((i) => {
      switch (i.code) {
        case "NO_KEYS":
          return ["❌ ยังไม่มีคีย์เข้ารหัส", "กรุณาสร้าง/เพิ่มคีย์อย่างน้อย 2 ดอกก่อนปลดล็อก"].join("\n");
        case "NOT_ENOUGH_KEYS":
          return ["❌ คีย์เข้ารหัสยังไม่ครบ", `ตอนนี้มี ${i.meta?.keyCount ?? "ไม่ทราบ"} ดอก`, "ต้องมีอย่างน้อย 2 ดอกถึงจะปลดล็อกได้"].join("\n");
        case "NO_IMPORT":
          return ["❌ ยังไม่ได้นำเข้าข้อมูลผู้เข้าสอบ", "กรุณา Import รายชื่อผู้เข้าสอบก่อน"].join("\n");
        case "MISSING_SEAT":
          return ["❌ ยังจัดที่นั่งสอบไม่ครบ", `ยังเหลืออีก ${i.meta?.missingSeat ?? "ไม่ทราบ"} คน ที่ยังไม่มีห้อง/แถว/คอลัมน์`, "กรุณาจัดที่นั่งให้ครบก่อนปลดล็อก"].join("\n");
        case "UNBAGGED":
          return ["❌ ยังมีเล่มข้อสอบที่ยังไม่ถูกใส่ถุง", `ยังเหลือ ${i.meta?.unbagged ?? "ไม่ทราบ"} เล่ม`, "กรุณาจัดถุงให้ครบก่อนปลดล็อก"].join("\n");
        case "QUESTION_COUNT_MISMATCH":
          return ["❌ จำนวนข้อสอบไม่ตรงกัน", `พบ ${i.meta?.mismatchCountTotal ?? "ไม่ทราบ"} วิชา/รอบ ที่จำนวนข้อในระบบไม่สอดคล้องกัน`, "กรุณาตรวจให้จำนวนข้อใน Session กับ Subject Questions ตรงกันก่อน"].join("\n");
        case "SLOT_MISSING":
          return ["❌ ยังสร้าง Slot การตรวจไม่ครบ", `ยังขาด ${i.meta?.missingSlotsTotal ?? "ไม่ทราบ"} slot`, "ต้องสร้าง slot ให้ครบทุกเล่ม/ทุกข้อ/ผู้ตรวจ 2 คนก่อนปลดล็อก"].join("\n");
        case "SLOT_NOT_COMPLETED":
          return ["❌ ยังตรวจข้อสอบไม่ครบ", `ยังเหลือ ${i.meta?.pendingSlots ?? i.meta?.notCompletedTotal ?? "ไม่ทราบ"} slot ที่สถานะยังไม่เสร็จ`, "ต้องให้สถานะเป็น COMPLETED ครบก่อนปลดล็อก"].join("\n");
        default:
          return `❌ ${i.message ?? "มีเงื่อนไขบางอย่างยังไม่ผ่าน"}`;
      }
    })
    .join("\n\n");
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
      const blindBooklets = await bookletsRepo.findBlindBookletsByCampaign(conn, campaignId);

      if (blindBooklets.length > 0) {
        try {
          // 🛑 หมายเหตุ: คุณต้องไปสร้าง/แก้ไขฟังก์ชันนี้ใน keyService ให้รับ FirstKey, SecondKey ด้วยนะครับ
          await keyService.decryptQrPayloadWithKeys(blindBooklets[0].qr_payload, FirstKey, SecondKey);
        } catch (err) {
          throw new Error("❌ คีย์ที่กรอกไม่สามารถนำไปถอดรหัสข้อสอบได้ กรุณาตรวจสอบคีย์อีกครั้ง");
        }

        // 2. ⚡ ถอดรหัสแบบขนาน โดยใช้คีย์ที่กรอกเข้ามาตรงๆ
        const decryptPromises = blindBooklets.map(async (b) => {
          try {
            // 🚀 โยนคีย์เข้าไปถอดรหัสตรงๆ เลย
            const decoded = await keyService.decryptQrPayloadWithKeys(b.qr_payload, FirstKey, SecondKey);

            if(b.session_id !== decoded.sid) {
              throw new Error(`วันที่สอบไม่ตรงกัน เกิดข้อผิดพลาด`);
            }
            return {
              success: true,
              bookletId: b.id,
              cid: decoded.cid,
              userCode: decoded.uid
            };
          } catch (err) {
            return { success: false, bookletId: b.id, qr: b.qr_payload };
          }
        });

        const decryptedResults = await Promise.all(decryptPromises);

        // 3. 🛡️ Error Handling: ดักจับรายการที่พัง
        const failedItems = decryptedResults.filter(r => !r.success);
        if (failedItems.length > 0) {
          const failedIds = failedItems.map(f => f.bookletId).slice(0, 5).join(", ");
          throw new Error(
            `❌ ขัดข้องทางข้อมูล: ถอดรหัสไม่ได้จำนวน ${failedItems.length} เล่ม\n` +
            `(ตัวอย่าง Booklet ID ที่มีปัญหา: ${failedIds})`
          );
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
        await bookletsRepo.bulkUpdateUnblindBooklets(conn, updates);
      }

      // อัปเดตสถานะแคมเปญเป็นปลดล็อคแล้ว
      await campaignRepo.unlockCampaign(campaignId, conn);

      await conn.commit();
      return {
        success: true,
        message: `ถอดรหัสปลดล็อครอบสอบสำเร็จ (เปิดเผยตัวตนข้อสอบไป ${blindBooklets.length} เล่ม)`
      };
    } catch (error: any) {
      await conn.rollback();
      throw new Error(error.message || "ไม่สามารถถอดรหัสปลดล็อครอบสอบได้");
    } finally {
      conn.release();
    }
  }
}