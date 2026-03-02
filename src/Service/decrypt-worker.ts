import { parentPort, workerData } from "worker_threads";
import { keyService, aesDecrypt } from "./key.service"; // 👈 เช็ค path ให้ตรงกับโปรเจกต์ของคุณ
import campaignRepo from "../Repo/campaign.repo"; 
import keyRepo from "../Repo/key.repo";

// ตั้งค่าตัวแปรเข้ารหัส (ต้องตรงกับที่ใช้สร้าง QR)
const PAYLOAD_ENCODING = "utf8";
const CIPHER_ENCODING = "base64";
const STATIC_IV_STRING = "encryptionivgodz"; // 16 bytes
const STATIC_IV_BUFFER = Buffer.from(STATIC_IV_STRING, PAYLOAD_ENCODING);

async function processDecryption() {
  const { booklets, campaign_id } = workerData;
  const results: { uid: string; qr_payload: string }[] = [];

  try {
    // 🛑 1. เช็คสถานะแคมเปญแค่ "ครั้งเดียว"
    const isActiveCamp = await campaignRepo.IscampaignActive(campaign_id);
    if (!isActiveCamp) throw new Error("Campaign inactive");

    // 🛑 2. ดึงคีย์จาก DB แค่ "ครั้งเดียว"
    const keys = await keyRepo.findAllByCampaignId(campaign_id);
    if (keys.length !== 2) throw new Error("Keys incomplete");

    const [key1, key2] = keys;

    // 🛑 3. ถอดรหัสคีย์ด้วย Master Key แค่ "ครั้งเดียว"
    const decryptedKey1Buffer = aesDecrypt(
      Buffer.from(key1.key, CIPHER_ENCODING), 
      Buffer.from(process.env.MASTER_KEY!, PAYLOAD_ENCODING), 
      STATIC_IV_BUFFER
    );
    const decryptedKey2Buffer = aesDecrypt(
      Buffer.from(key2.key, CIPHER_ENCODING), 
      Buffer.from(process.env.MASTER_KEY!, PAYLOAD_ENCODING), 
      STATIC_IV_BUFFER
    );
    
    const key1Buffer = Buffer.from(decryptedKey1Buffer.toString(PAYLOAD_ENCODING), PAYLOAD_ENCODING);
    const key2Buffer = Buffer.from(decryptedKey2Buffer.toString(PAYLOAD_ENCODING), PAYLOAD_ENCODING);

    // 🚀 4. เริ่มวนลูป 6,000 เล่มด้วยความเร็วแสง (ทำแค่คณิตศาสตร์ใน RAM ล้วนๆ)
    for (const b of booklets) {
      // ใช้ decryptFast ที่เราเพิ่งสร้างใหม่ใน key.service.ts
      const decoded = keyService.decryptFast(b.qr_payload, key1Buffer, key2Buffer);
      
      // รองรับทั้งแบบเก่าและใหม่
      const uid = decoded?.user_code || decoded?.uid || decoded?.user_id || null;
      
      if (uid) {
        results.push({ uid: String(uid), qr_payload: b.qr_payload });
      }
    }

    // ส่งผลลัพธ์กลับไปที่ Main Thread ทันที
    parentPort?.postMessage(results);

  } catch (error) {
    console.error("Worker Initialization Failed:", error);
    parentPort?.postMessage([]); // ส่ง array ว่างกลับไปถ้าพังตั้งแต่ต้น จะได้ไม่ค้าง
  }
}

processDecryption();