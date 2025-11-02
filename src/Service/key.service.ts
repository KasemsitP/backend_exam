import { DB } from "../model/DB";
import keyRepo from "../Repo/key.repo";
import crypto from "crypto";
import userImportRepo from "../Repo/importuser.repo";
const ALGORITHM = "aes-128-ctr";
const PAYLOAD_ENCODING = "utf8";
const CIPHER_ENCODING = "base64"; // (ใช้ base64 ตามโค้ดของคุณ)



function aesEncrypt(
  textBuffer: Buffer,
  key: Buffer,
  iv: Buffer
): Buffer {
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  return Buffer.concat([cipher.update(textBuffer), cipher.final()]);
}


function aesDecrypt(
  cipherBuffer: Buffer,
  key: Buffer,
  iv: Buffer
): Buffer {
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  return Buffer.concat([decipher.update(cipherBuffer), decipher.final()]);
}

export class keyService {

  static create = async (campaignId: number, key: string) => { // [ ⭐️ FIX ⭐️ ]
    const connection = await DB.getInstance().getConnection();
    try {
      await connection.beginTransaction();

      const count = await keyRepo.countByCampaignId(campaignId, connection);
      if (count >= 2) {
        throw new Error("Key limit (2) reached for this campaign.");
      }
      const iv1 = Buffer.from("1234567891234567", 'utf8')
     // const iv = crypto.randomBytes(16).toString("hex");
      const algor = "aes-256-ctr"; 
      const ivBase64 = iv1.toString("base64");
      const newKey = await keyRepo.create(
        {
          campaign_id: campaignId,
          key: key, // [ ⭐️ FIX ⭐️ ] (key_alias -> key)
          iv: ivBase64,
          algor: algor,
        },
        connection
      );

      await connection.commit();
      return newKey;
    } catch (error) {
      await connection.rollback();
      console.error("Service Error (Key Create):", error);
      throw error;
    } finally {
      connection.release();
    }
  };

  /**
   * [ 2. Logic "Delete" (เหมือนเดิม) ]
   */
  static delete = async (keyId: number): Promise<boolean> => {
    try {
      return await keyRepo.delete(keyId);
    } catch (error) {
      console.error("Service Error (Key Delete):", error);
      throw error;
    }
  };

  /**
   * [ 3. Logic "Get" (เหมือนเดิม) ]
   */
  static getAllForCampaign = async (campaignId: number) => {
    try {
      return await keyRepo.findAllByCampaignId(campaignId);
    } catch (error) {
      console.error("Service Error (Key Get):", error);
      throw error;
    }
  };
  static getPrerequisites = async (campaignId: number) => {
    const [keyCount, userCount] = await Promise.all([
      keyRepo.countByCampaignId(campaignId),
      userImportRepo.countByCampaignId(campaignId), // 👈 (เรียก Repo ใน Canvas)
    ]);
    return {
      hasTwoKeys: keyCount === 2,
      hasImportedUsers: userCount > 0,
    };
  };
static runBulkEncryptionForSession = async (
    campaignId: number,
    sessionId: number
  ) => {
    const connection = await DB.getInstance().getConnection();
    let usersEncrypted = 0;
    try {
      await connection.beginTransaction();

      // 1. ดึงคีย์ (เหมือนเดิม)
      const keys = await keyRepo.findAllByCampaignId(campaignId, connection);
      if (keys.length < 2) {
        throw new Error("Key check failed: Campaign must have 2 keys.");
      }
      
      // [ ⭐️ 2. (แก้ไข) แปลงคีย์และ IV เป็น Buffer ⭐️ ]
      // (เราจะใช้ "key" และ "iv" ที่สุ่มและเก็บไว้ใน DB
      // แทนการใช้ "encryptionivgodz" ที่ Hardcode)
      const [key1, key2] = keys;
      
      // (สมมติว่า 'key' ที่ User กรอก ถูกเก็บเป็น 'utf8')
      const key1Buffer = Buffer.from(key1.key, PAYLOAD_ENCODING); 
      const key2Buffer = Buffer.from(key2.key, PAYLOAD_ENCODING);
      
      // (สมมติว่า 'iv' ที่เราสุ่มตอน 'create' ถูกเก็บเป็น 'hex')
      const iv1Buffer = Buffer.from(key1.iv, "hex"); 
      const iv2Buffer = Buffer.from(key2.iv, "hex");

      // 3. ดึงข้อมูล User (เหมือนเดิม)
      const allUserLinks = await userImportRepo.findAllUserLinksForSession(
        sessionId,
        connection
      );
      if (allUserLinks.length === 0) {
        throw new Error(
          "User list check failed: No users found in this session."
        );
      }


      for (const userLink of allUserLinks) {
        const payload = {
          cid: campaignId,
          sid: sessionId,
          uid: userLink.user_id,
          ucid: userLink.user_campaign_id,
          usid: userLink.user_session_id,
        };
        const plainTextBuffer = Buffer.from(JSON.stringify(payload), PAYLOAD_ENCODING);

        const step1 = aesEncrypt(plainTextBuffer, key1Buffer, iv1Buffer);
        const step2 = aesEncrypt(step1, key2Buffer, iv2Buffer);
        
        const finalCiphertext = step2.toString(CIPHER_ENCODING); 

        await userImportRepo.updateQrPayload(
          userLink.user_session_id,
          finalCiphertext,
          connection
        );
        usersEncrypted++;
      }

      await connection.commit();
      return { usersEncrypted }; 
    } catch (error) {
      await connection.rollback();
      console.error("Service Error (Bulk Encryption):", error);
      throw error;
    } finally {
      connection.release();
    }
  };
}

