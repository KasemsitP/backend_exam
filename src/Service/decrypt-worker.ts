import { parentPort, workerData } from "worker_threads";
import { keyService, aesDecrypt } from "./key.service";
import campaignRepo from "../Repo/campaign.repo";
import keyRepo from "../Repo/key.repo";

const PAYLOAD_ENCODING = "utf8";
const CIPHER_ENCODING = "base64";

async function processDecryption() {
  const { booklets, campaign_id } = workerData;
  const results: { uid: string; qr_payload: string }[] = [];

  try {
    // 1. เช็คสถานะแคมเปญครั้งเดียว
    const isActiveCamp = await campaignRepo.IscampaignActive(campaign_id);
    if (!isActiveCamp) throw new Error("Campaign inactive");

    // 2. ดึงคีย์จาก DB ครั้งเดียว
    const keys = await keyRepo.findAllByCampaignId(campaign_id);
    if (keys.length !== 2) throw new Error("Keys incomplete");

    const keyFirst = keys.find((k: any) => k.order_num === 1);
    const keySecond = keys.find((k: any) => k.order_num === 2);

    if (!keyFirst || !keySecond) {
      throw new Error("Keys incomplete");
    }

    // 3. ถอดรหัส campaign keys ด้วย MASTER_KEY ครั้งเดียว
    const masterKeyBuffer = Buffer.from(process.env.MASTER_KEY || "", PAYLOAD_ENCODING);

    if (masterKeyBuffer.length !== 16) {
      throw new Error("MASTER_KEY must be 16 bytes for AES-128-GCM");
    }

    const decryptedKey1Buffer = aesDecrypt(
      Buffer.from(keyFirst.key, CIPHER_ENCODING),
      masterKeyBuffer
    );

    const decryptedKey2Buffer = aesDecrypt(
      Buffer.from(keySecond.key, CIPHER_ENCODING),
      masterKeyBuffer
    );

    const key1Buffer = Buffer.from(
      decryptedKey1Buffer.toString(PAYLOAD_ENCODING),
      PAYLOAD_ENCODING
    );

    const key2Buffer = Buffer.from(
      decryptedKey2Buffer.toString(PAYLOAD_ENCODING),
      PAYLOAD_ENCODING
    );

    if (key1Buffer.length !== 16) {
      throw new Error("Campaign key 1 must be 16 bytes");
    }

    if (key2Buffer.length !== 16) {
      throw new Error("Campaign key 2 must be 16 bytes");
    }

    // 4. วนถอดรหัส booklets ใน RAM
    for (const b of booklets) {
      const decoded = keyService.decryptFast(b.qr_payload, key1Buffer, key2Buffer);

      const uid =
        decoded?.user_code ||
        decoded?.uid ||
        decoded?.user_id ||
        null;

      if (uid) {
        results.push({
          uid: String(uid),
          qr_payload: b.qr_payload,
        });
      }
    }

    parentPort?.postMessage(results);
  } catch (error) {
    console.error("Worker Initialization Failed:", error);
    parentPort?.postMessage([]);
  }
}

processDecryption();