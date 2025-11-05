import { DB } from "../model/DB";
import * as keyService from "./key.service"; 
import userSessionsRepo from "../Repo/user-session.repo"; // (Import Repo จาก Canvas)

interface VerifyQrPayload {
  qrPayload: string;   // (Base64 string)
  campaignId: string; // (e.g., "camp-1")
  sessionId: string;  // (e.g., "sess-10")
}

function parseId(id: string | number): number {
  if (typeof id === "number") {
    return id; // (ถ้าเป็น 1 ➜ 1)
  }
  return parseInt(id.replace(/\D/g, "")); 
}


export class verifyService {

  static verifyQrPayload = async (payload: VerifyQrPayload) => {
    const connection = await DB.getInstance().getConnection();
    try {
      // (แปลง ID)
      const campaignIdNumeric = parseId(payload.campaignId);
      const sessionIdNumeric = parseId(payload.sessionId);
        console.log(payload.qrPayload , campaignIdNumeric  , " ",sessionIdNumeric)

      // 1. ถอดรหัส (Decrypt)
      const decryptedPayload = await keyService.keyService.decryptQrPayload(
        payload.qrPayload,
        campaignIdNumeric,
      );

      if (!decryptedPayload || !decryptedPayload.uid || !decryptedPayload.sid) {
        throw new Error(`QR Code ไม่ถูกต้อง หรือถอดรหัสล้มเหลว`);
      }
      console.log(decryptedPayload)
      // 2. ⭐️ (ตรวจสอบความปลอดภัย) ⭐️
      // (เช็คว่า QR Code นี้ ตรงกับ Session ที่เจ้าหน้าที่กำลังคุมสอบหรือไม่)
      if (decryptedPayload.sid !== sessionIdNumeric) {
        throw new Error(`QR Code นี้สำหรับ Session อื่น (Expected: ${sessionIdNumeric}, Got: ${decryptedPayload.sid})`);
      }

      // 3. ดึงข้อมูลผู้สอบ (ใช้ฟังก์ชันใน Canvas)
      const userSession = await userSessionsRepo.findByUserCodeAndSessionId(
        decryptedPayload.uid,
        decryptedPayload.sid,
        connection
      );

      if (!userSession) {
        throw new Error(`ไม่พบข้อมูลผู้สอบ (UserCode: ${decryptedPayload.ucode})`);
      }

      return userSession; // (ส่งข้อมูลผู้สอบกลับไป)

    } catch (error) {
      // (ไม่ต้อง Rollback เพราะนี่คือ Read-only)
      console.error("Service Error (Verify QR):", error);
      throw error;
    } finally {
      connection.release();
    }
  };
}