import { DB } from "../model/DB";
import keyRepo from "../Repo/key.repo";
import crypto from "crypto";
import userImportRepo from "../Repo/importuser.repo";
import { PoolConnection } from "mysql2/promise";

// ⭐️ FIX: เปลี่ยนจาก CTR เป็น CBC
const ALGORITHM = "aes-128-cbc"; 
const PAYLOAD_ENCODING = "utf8";
const CIPHER_ENCODING = "base64"; 
const IV_LENGTH = 16; // IV ต้องยาว 16 ไบต์ (128 bits)

const STATIC_IV_STRING = "encryptionivgodz"; // 16 bytes
const STATIC_IV_BUFFER = Buffer.from(STATIC_IV_STRING, PAYLOAD_ENCODING);


function aesEncrypt(
  textBuffer: Buffer,
  key: Buffer,
  iv: Buffer
): Buffer {

  if (iv.length !== IV_LENGTH) {
    console.error(`IV length is ${iv.length}, expected ${IV_LENGTH}`);
    throw new Error("Invalid IV length passed to aesEncrypt.");
  }

  if (key.length !== 16) {
    console.error(`Key length is ${key.length}, expected 16`);
    throw new Error("Invalid Key length passed to aesEncrypt (must be 16 bytes for AES-128).");
  }
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  return Buffer.concat([cipher.update(textBuffer), cipher.final()]);
}


function aesDecrypt(
  cipherBuffer: Buffer,
  key: Buffer,
  iv: Buffer
): Buffer {
  // ตรวจสอบ IV length เพื่อ Debug
  if (iv.length !== IV_LENGTH) {
    console.error(`IV length is ${iv.length}, expected ${IV_LENGTH}`);
    throw new Error("Invalid IV length passed to aesDecrypt.");
  }
  if (key.length !== 16) {
    console.error(`Key length is ${key.length}, expected 16`);
    throw new Error("Invalid Key length passed to aesDecrypt (must be 16 bytes for AES-128).");
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  return Buffer.concat([decipher.update(cipherBuffer), decipher.final()]);
}

export class keyService {


  static create = async (campaignId: number, key: string) => { 
    if (Buffer.from(key, PAYLOAD_ENCODING).length !== 16) {
        throw new Error("Key must be exactly 16 characters (16 bytes).");
    }

    const connection = await DB.getInstance().getConnection();
    try {
      await connection.beginTransaction();

      const count = await keyRepo.countByCampaignId(campaignId, connection);
      if (count >= 2) {
        throw new Error("Key limit (2) reached for this campaign.");
      }
      
      const newKey = await keyRepo.create(
        {
          campaign_id: campaignId,
          key: key, 
          iv: STATIC_IV_STRING, 
          algor: ALGORITHM, 
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
      userImportRepo.countByCampaignId(campaignId), 
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

      // 1. ดึงคีย์
      const keys = await keyRepo.findAllByCampaignId(campaignId, connection);
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
          uid: userLink.user_code,
        };
        console.log(payload)
        const plainTextBuffer = Buffer.from(JSON.stringify(payload), PAYLOAD_ENCODING);

        // ⭐️ 5. (FIX) เข้ารหัสโดยใช้ Static IVs
        const step1 = aesEncrypt(plainTextBuffer, key1Buffer, iv1Buffer);
        console.log("Step 1 Encrypted Buffer:", step1.toString('base64'));
        const step2 = aesEncrypt(step1, key2Buffer, iv2Buffer);
        console.log("Step 2 Encrypted Buffer:", step2.toString('base64'));
        
        // ⭐️ 6. (FIX) เก็บเฉพาะ Ciphertext (ไม่ต้องเก็บ IV)
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

  /**
   * [ ⭐️ FIX: (Decrypt) ⭐️ ]
   * แก้ไขให้ใช้ Static IV
   */
  static decryptQrPayload = async (
    ciphertext: string,
    campaignId: number
  ) => {
    try {
      // 1. ดึงคีย์ (เหมือนเดิม)
      const keys = await keyRepo.findAllByCampaignId(campaignId);
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
    } catch (error) {
      console.error("Service Error (Decryption):", error);
      throw new Error("Decryption failed. Invalid payload or keys.");
    }
  };

  static decryptQrPayloadConnection = async (
    ciphertext: string,
    campaignId: number,
    connection: PoolConnection
  ) => {
    try {
      // 1. ดึงคีย์ (เหมือนเดิม)
      const keys = await keyRepo.findAllByCampaignId(campaignId);
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
    } catch (error) {
      console.error("Service Error (Decryption):", error);
      throw new Error("Decryption failed. Invalid payload or keys.");
    }
  };
}


