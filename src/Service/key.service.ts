import { DB } from "../model/DB";
import keyRepo from "../Repo/key.repo";
import crypto from "crypto";
import userImportRepo from "../Repo/importuser.repo";
import { PoolConnection } from "mysql2/promise";
import dashboardRepo from "../Repo/dashboard.repo";
import settingsRepo from "../Repo/settings.repo";
import campaignRepo from "../Repo/campaign.repo";
import { authservice } from "./auth.service";
import bookletsRepo from "../Repo/booklets.repo";
import { shuffle } from "lodash";

//FIX: เปลี่ยนจาก CTR เป็น CBC

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
        throw new Error("IV ต้องมีความยาว 16 ไบต์ (128 bits) สำหรับ AES-128");
    }

    if (key.length !== 16) {
        console.error(`Key length is ${key.length}, expected 16`);
        throw new Error("คีย์ต้องมีความยาว 16 ไบต์ (128 bits) สำหรับ AES-128");
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


    private static MASKING_KEY = process.env.SCAN_SECRET_KEY || "tonlnwzasdadasdegery";
    static create = async (campaignId: number, key: string, account_id: number, order_num: number) => {
        if (Buffer.from(key, PAYLOAD_ENCODING).length !== 16) {
            throw new Error("คีย์ต้องมีความยาว 16 ตัวอักษร (128 bits) สำหรับ AES-128");
        }

        const connection = await DB.getInstance().getConnection();
        try {
            await connection.beginTransaction();

            const count = await keyRepo.countByCampaignId(campaignId, connection);
            if (count >= 2) {
                throw new Error("คีย์สำหรับรอบสอบนี้มีครบแล้ว (2 คีย์)");
            }

            const checkRole = await keyRepo.checkRoles(account_id, connection);
            if (!checkRole || checkRole.code !== "MANAGER") {
                throw new Error("คุณไม่มีสิทธิ์ในการสร้างคีย์นี้เนื่องจากคุณไม่ใช่ผู้จัดการคีย์");
            }


            const is_assigned = await keyRepo.isAssigned(account_id, campaignId, connection);
            if (is_assigned) {
                throw new Error("คุณได้เคยสร้างคีย์สำหรับการเข้ารหัสรอบนี้แล้ว ไม่สามารถสร้างใหม่ได้อีก");
            }

            const order = count;
            console.log(order)

            // if (Number(order) == 0) {
            //     order_num = 1;
            // }
            // else {
            //     order_num = 2;
            // }
            const iv1Buffer = STATIC_IV_BUFFER
            const key1Buffer = Buffer.from(process.env.MASTER_KEY!, PAYLOAD_ENCODING);

            const plainTextBuffer = Buffer.from(key, PAYLOAD_ENCODING);
            const step1 = aesEncrypt(plainTextBuffer, key1Buffer, iv1Buffer);

            const newKey = await keyRepo.create(
                {
                    campaign_id: campaignId,
                    // key: key,
                    key: step1.toString(CIPHER_ENCODING),
                    account_id: account_id,
                    iv: STATIC_IV_STRING,
                    algor: ALGORITHM,
                    order_num: order_num
                },
                connection
            );

            const decryptedBuffer = aesDecrypt(step1, key1Buffer, iv1Buffer);
            const decryptedKey = decryptedBuffer.toString(PAYLOAD_ENCODING);
            console.log("Decrypted Key for verification:", decryptedKey);


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
    static delete = async (
        keyId: number,
        campaignId: number,
        accountId: number
    ): Promise<boolean> => {

        const conn = await DB.getInstance().getConnection();

        try {
            await conn.beginTransaction();


            const checkRole = await keyRepo.checkRoles(accountId, conn);
            if (!checkRole || checkRole.code !== "MANAGER") {
                throw new Error("คุณไม่มีสิทธิ์ในการลบคีย์นี้เนื่องจากคุณไม่ใช่ผู้จัดการคีย์");
            }

            const keyData = await keyRepo.findKeys(keyId, campaignId, conn);

            if (!keyData) {
                throw new Error("ไม่พบคีย์ที่ต้องการลบ");
            }

            if (keyData.account_id !== accountId) {
                throw new Error("คุณไม่มีสิทธิ์ในการลบคีย์นี้เนื่องจากคุณไม่ได้เป็นเจ้าของคีย์");
            }


            await keyRepo.delete(keyId, conn);

            await conn.commit();
            return true;

        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
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

    static getAllForCampaignManager = async (campaignId: number, AccountId: number) => {
        try {
            return await keyRepo.findAllByCampaignIdByManager(campaignId, AccountId);
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

    static decryptQrPayloadWithKeys = async (
        qrPayload: string,
        FirstKey: string,
        SecondKey: string
    ) => {
        try {

            const key1Buffer = Buffer.from(FirstKey, PAYLOAD_ENCODING);
            const key2Buffer = Buffer.from(SecondKey, PAYLOAD_ENCODING);


            const iv1Buffer = STATIC_IV_BUFFER;
            const iv2Buffer = STATIC_IV_BUFFER;


            const cipherBuffer = Buffer.from(qrPayload, CIPHER_ENCODING);


            const step1DecryptedBuffer = aesDecrypt(cipherBuffer, key2Buffer, iv2Buffer);


            const finalDecryptedBuffer = aesDecrypt(step1DecryptedBuffer, key1Buffer, iv1Buffer);


            const plainTextJsonString = finalDecryptedBuffer.toString(PAYLOAD_ENCODING);
            const payload = JSON.parse(plainTextJsonString);


            return payload;

        } catch (error: any) {
            console.error("Service Error (decryptQrPayloadWithKeys):", error);
            // ถ้าคีย์ผิด หรือ QR พัง มันจะเด้งเข้า catch ทันที 
            throw new Error("คีย์ที่กรอกไม่ถูกต้อง หรือข้อมูล QR Code เสียหาย ไม่สามารถถอดรหัสได้");
        }
    };
    static runBulkEncryptionForSession = async (
        campaignId: number,
    ) => {

        const activeCamp = await campaignRepo.IscampaignActive(campaignId);
        if (!activeCamp) {
            throw new Error(`ไม่สามารถเข้ารหัสคิวอาร์โค้ดได้เนื่องจากรอบสอบนี้ยังไม่เปิดใช้งาน`);
        }

        const countkeys = await keyRepo.countByCampaignId(campaignId);
        if (countkeys < 1) {
            throw new Error("ไม่สามารถทำการเข้ารหัสได้เนื่องจากรอบสอบนี้มีคีย์ไม่ครบ 2 คีย์");
        }

        const is_imported = await userImportRepo.IsImported(campaignId);
        if (!is_imported) {
            throw new Error("ไม่สามารถเข้ารหัสคิวอาร์โค้ดได้เนื่องจากรอบสอบนี้ยังไม่มีการนำเข้าข้อมูลมาก่อน ");
        }

        const connection = await DB.getInstance().getConnection();
        let usersEncrypted = 0;
        try {
            await connection.beginTransaction();

            const sessionRows = await keyRepo.selectSessionIdByCampaign(
                campaignId,
                connection
            );

            // แปลงเป็น number[]
            const sessionIds = sessionRows.map(s => s.id);

            // 1. ดึงคีย์
            const keys = await keyRepo.findAllByCampaignId(campaignId, connection);
            if (keys.length !== 2) {
                throw new Error("ไม่สามารถทำการเข้ารหัสได้เนื่องจากรอบสอบนี้มีคีย์ไม่ครบ 2 คีย์");
            }

            const keyFirst = keys.find(k => k.order_num === 1);
            const keySecond = keys.find(k => k.order_num === 2);

            if (!keyFirst || !keySecond) {
                throw new Error("คีย์สำหรับรอบสอบนี้ไม่ครบ 2 คีย์");
            }

            const decryptedKey1Buffer = aesDecrypt(Buffer.from(keyFirst.key, CIPHER_ENCODING), Buffer.from(process.env.MASTER_KEY!, PAYLOAD_ENCODING), STATIC_IV_BUFFER);
            const decryptedKey1 = decryptedKey1Buffer.toString(PAYLOAD_ENCODING);

            const decryptedKey2Buffer = aesDecrypt(Buffer.from(keySecond.key, CIPHER_ENCODING), Buffer.from(process.env.MASTER_KEY!, PAYLOAD_ENCODING), STATIC_IV_BUFFER);
            const decryptedKey2 = decryptedKey2Buffer.toString(PAYLOAD_ENCODING);

            const key1Buffer = Buffer.from(decryptedKey1, PAYLOAD_ENCODING);
            const key2Buffer = Buffer.from(decryptedKey2, PAYLOAD_ENCODING);

            // Static IV Buffer ที่กำหนดไว้
            const iv1Buffer = STATIC_IV_BUFFER;
            const iv2Buffer = STATIC_IV_BUFFER;

            for (const sessionId of sessionIds) {
                const isAlreadyGenerated = await bookletsRepo.checkIfSessionEncrypted(sessionId, connection);
                if (isAlreadyGenerated) {
                    console.warn(`Session ${sessionId} already has booklets generated. Skipping.`);
                    continue; // ข้ามไปทำ Session ถัดไป หรือจะ Throw Error ก็ได้ตาม Business Logic
                }

                // ดึงรายชื่อคนที่มีสิทธิ์สอบใน Session นี้
                const allUserLinks = await userImportRepo.findAllUserLinksForSession(
                    sessionId,
                    connection
                );

                if (allUserLinks.length === 0) {
                    console.warn(`No users found for session ${sessionId}`);
                    throw new Error(`users in some session not imported yet ${sessionId}`);
                }
                const shuffledUserLinks = shuffle(allUserLinks);

                console.log(`Shuffled and Encrypting ${shuffledUserLinks.length} users for session ${sessionId}`);
                const CHUNK_SIZE = 500;


                for (let i = 0; i < shuffledUserLinks.length; i += CHUNK_SIZE) {
                    const chunk = shuffledUserLinks.slice(i, i + CHUNK_SIZE);

                    const bookletsToInsert: { session_id: number; qr_payload: string }[] = [];

                    // 1. เข้ารหัสข้อมูลสำหรับ 500 คนใน Memory
                    for (const userLink of chunk) {
                        const payload = {
                            cid: campaignId,
                            sid: sessionId,
                            uid: userLink.user_id, // เก็บแค่ user_id
                        };

                        const plainTextBuffer = Buffer.from(
                            JSON.stringify(payload),
                            PAYLOAD_ENCODING
                        );

                        const step1 = aesEncrypt(plainTextBuffer, key1Buffer, iv1Buffer);
                        const step2 = aesEncrypt(step1, key2Buffer, iv2Buffer);
                        const finalCiphertext = step2.toString(CIPHER_ENCODING);

                        //  เตรียม Data สำหรับ Insert ลง booklets
                        bookletsToInsert.push({
                            session_id: sessionId,
                            qr_payload: finalCiphertext
                        });

                        usersEncrypted++;
                    }



                    // 2. 🛑 ส่งข้อมูล 500 รายการไป Insert ลงตาราง booklets ใน 1 Query
                    await bookletsRepo.bulkInsertBooklets(bookletsToInsert, connection);
                }
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

    static decryptQrPayload = async (
        ciphertext: string,
        campaignId: number
    ) => {
        let flag_qr_inactive = false
        try {
            const isActiveCamp = await campaignRepo.IscampaignActive(campaignId);
            if (!isActiveCamp) {
                flag_qr_inactive = true;
                throw new Error("ไม่สามารถสแกนคิวอาร์โค้ดได้เนื่องจากรอบสอบนี้ยังไม่เปิดใช้งาน");
            }

            const isQrActive = await settingsRepo.QRStatus(campaignId);
            if (!isQrActive) {
                flag_qr_inactive = true;
                throw new Error("ไม่สามารถสแกนคิวอาร์โค้ดได้เนื่องจากระบบสแกนคิวอาร์โค้ดถูกปิดใช้งานอยู่");
            }
            console.log("QR Status:", isQrActive);
            // 1. ดึงคีย์ (เหมือนเดิม)
            const keys = await keyRepo.findAllByCampaignId(campaignId);
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

            const decryptedKey1Buffer = aesDecrypt(Buffer.from(key1.key, CIPHER_ENCODING), Buffer.from(process.env.MASTER_KEY!, PAYLOAD_ENCODING), STATIC_IV_BUFFER);
            const decryptedKey2Buffer = aesDecrypt(Buffer.from(key2.key, CIPHER_ENCODING), Buffer.from(process.env.MASTER_KEY!, PAYLOAD_ENCODING), STATIC_IV_BUFFER);
            const key1Buffer = Buffer.from(decryptedKey1Buffer.toString(PAYLOAD_ENCODING), PAYLOAD_ENCODING);
            const key2Buffer = Buffer.from(decryptedKey2Buffer.toString(PAYLOAD_ENCODING), PAYLOAD_ENCODING);

            console.log(decryptedKey1Buffer.toString(PAYLOAD_ENCODING), decryptedKey2Buffer.toString(PAYLOAD_ENCODING))
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
        } catch (error: any) {
            console.error("Service Error (Decryption):", error);

            if (flag_qr_inactive) {
                throw new Error("ไม่สามารถสแกนคิวอาร์โค้ดได้เนื่องจากระบบสแกนคิวอาร์โค้ดถูกปิดใช้งานอยู่");

            }

            throw new Error("ไม่สามารถถอดรหัสได้ เนื่องจากข้อมูลไม่ถูกต้องหรือคีย์ไม่ครบถ้วน");
        }
    };


    static decryptPayloadStaff = async (
        ciphertext: string,
        campaignId: number
    ) => {
        let flag_qr_inactive = false
        try {
            const isActiveCamp = await campaignRepo.IscampaignActive(campaignId);
            if (!isActiveCamp) {
                flag_qr_inactive = true;
                throw new Error("ไม่สามารถสแกนคิวอาร์โค้ดได้เนื่องจากรอบสอบนี้ยังไม่เปิดใช้งาน");
            }

            // 1. ดึงคีย์ (เหมือนเดิม)
            const keys = await keyRepo.findAllByCampaignId(campaignId);
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

            const decryptedKey1Buffer = aesDecrypt(Buffer.from(key1.key, CIPHER_ENCODING), Buffer.from(process.env.MASTER_KEY!, PAYLOAD_ENCODING), STATIC_IV_BUFFER);
            const decryptedKey2Buffer = aesDecrypt(Buffer.from(key2.key, CIPHER_ENCODING), Buffer.from(process.env.MASTER_KEY!, PAYLOAD_ENCODING), STATIC_IV_BUFFER);
            const key1Buffer = Buffer.from(decryptedKey1Buffer.toString(PAYLOAD_ENCODING), PAYLOAD_ENCODING);
            const key2Buffer = Buffer.from(decryptedKey2Buffer.toString(PAYLOAD_ENCODING), PAYLOAD_ENCODING);

            console.log(decryptedKey1Buffer.toString(PAYLOAD_ENCODING), decryptedKey2Buffer.toString(PAYLOAD_ENCODING))
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
        } catch (error: any) {
            console.error("Service Error (Decryption):", error);

            if (flag_qr_inactive) {
                throw new Error("ไม่สามารถสแกนคิวอาร์โค้ดได้เนื่องจากระบบสแกนคิวอาร์โค้ดถูกปิดใช้งานอยู่");

            }

            throw new Error("ไม่สามารถถอดรหัสได้ เนื่องจากข้อมูลไม่ถูกต้องหรือคีย์ไม่ครบถ้วน");
        }
    };

    static decryptQrPayloadNoLocks = async (
        ciphertext: string,
        campaignId: number
    ) => {
        let flag_qr_inactive = false
        try {
            const isActiveCamp = await campaignRepo.IscampaignActive(campaignId);
            if (!isActiveCamp) {
                flag_qr_inactive = true;
                throw new Error("ไม่สามารถสแกนคิวอาร์โค้ดได้เนื่องจากรอบสอบนี้ยังไม่เปิดใช้งาน");
            }

            const keys = await keyRepo.findAllByCampaignId(campaignId);
            if (keys.length !== 2) {
                throw new Error("ไม่สามารถถอดรหัสได้ เนื่องจากรอบสอบนี้ต้องมีคีย์ทั้งหมด 2 คีย์");
            }

            const [key1, key2] = keys;


            const iv1Buffer = STATIC_IV_BUFFER;
            const iv2Buffer = STATIC_IV_BUFFER;

            const decryptedKey1Buffer = aesDecrypt(Buffer.from(key1.key, CIPHER_ENCODING), Buffer.from(process.env.MASTER_KEY!, PAYLOAD_ENCODING), STATIC_IV_BUFFER);
            const decryptedKey2Buffer = aesDecrypt(Buffer.from(key2.key, CIPHER_ENCODING), Buffer.from(process.env.MASTER_KEY!, PAYLOAD_ENCODING), STATIC_IV_BUFFER);
            const key1Buffer = Buffer.from(decryptedKey1Buffer.toString(PAYLOAD_ENCODING), PAYLOAD_ENCODING);
            const key2Buffer = Buffer.from(decryptedKey2Buffer.toString(PAYLOAD_ENCODING), PAYLOAD_ENCODING);

            console.log(decryptedKey1Buffer.toString(PAYLOAD_ENCODING), decryptedKey2Buffer.toString(PAYLOAD_ENCODING))

            const cipherBuffer = Buffer.from(ciphertext, CIPHER_ENCODING);



            const step1DecryptedBuffer = aesDecrypt(cipherBuffer, key2Buffer, iv2Buffer);


            const finalDecryptedBuffer = aesDecrypt(step1DecryptedBuffer, key1Buffer, iv1Buffer);


            const plainTextJsonString = finalDecryptedBuffer.toString(PAYLOAD_ENCODING);


            const payload = JSON.parse(plainTextJsonString);

            return payload;
        } catch (error: any) {
            console.error("Service Error (Decryption):", error);

            if (flag_qr_inactive) {
                throw new Error("ไม่สามารถสแกนคิวอาร์โค้ดได้เนื่องจากระบบสแกนคิวอาร์โค้ดถูกปิดใช้งานอยู่");

            }

            throw new Error("ไม่สามารถถอดรหัสได้ เนื่องจากข้อมูลไม่ถูกต้องหรือคีย์ไม่ครบถ้วน");
        }
    };

    static decryptQrPayloadBags = async (
        ciphertext: string,
        campaignId: number
    ) => {
        let flag_qr_inactive = false
        try {
            const isActiveCamp = await campaignRepo.IscampaignActive(campaignId);
            if (!isActiveCamp) {
                flag_qr_inactive = true;
                throw new Error("ไม่สามารถสแกนคิวอาร์โค้ดได้เนื่องจากรอบสอบนี้ยังไม่เปิดใช้งาน");
            }

            // // const isQrActive = await settingsRepo.QRStatus(campaignId);
            // // if (!isQrActive) {
            // //     flag_qr_inactive = true;
            // //     throw new Error("ไม่สามารถสแกนคิวอาร์โค้ดได้เนื่องจากระบบสแกนคิวอาร์โค้ดถูกปิดใช้งานอยู่");
            // // }
            // console.log("QR Status:", isQrActive);
            // 1. ดึงคีย์ (เหมือนเดิม)
            const keys = await keyRepo.findAllByCampaignId(campaignId);
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

            const decryptedKey1Buffer = aesDecrypt(Buffer.from(key1.key, CIPHER_ENCODING), Buffer.from(process.env.MASTER_KEY!, PAYLOAD_ENCODING), STATIC_IV_BUFFER);
            const decryptedKey2Buffer = aesDecrypt(Buffer.from(key2.key, CIPHER_ENCODING), Buffer.from(process.env.MASTER_KEY!, PAYLOAD_ENCODING), STATIC_IV_BUFFER);
            const key1Buffer = Buffer.from(decryptedKey1Buffer.toString(PAYLOAD_ENCODING), PAYLOAD_ENCODING);
            const key2Buffer = Buffer.from(decryptedKey2Buffer.toString(PAYLOAD_ENCODING), PAYLOAD_ENCODING);

            console.log(decryptedKey1Buffer.toString(PAYLOAD_ENCODING), decryptedKey2Buffer.toString(PAYLOAD_ENCODING))
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
        } catch (error: any) {
            console.error("Service Error (Decryption):", error);

            if (flag_qr_inactive) {
                throw new Error("ไม่สามารถสแกนคิวอาร์โค้ดได้เนื่องจากระบบสแกนคิวอาร์โค้ดถูกปิดใช้งานอยู่");

            }

            throw new Error("ไม่สามารถถอดรหัสได้ เนื่องจากข้อมูลไม่ถูกต้องหรือคีย์ไม่ครบถ้วน");
        }
    };

    static decrypteKeyForUnlock = async (campaignId: number, connection: PoolConnection) => {
        try {
            const activeCamp = await campaignRepo.IscampaignActive(campaignId, connection);
            if (!activeCamp) {
                throw new Error(`ไม่สามารถปลดล็อคข้อมูลรอบสอบนี้ได้เนื่องจากรอบสอบนี้ยังไม่เปิดใช้งาน`);
            }
            const keys = await keyRepo.findAllByCampaignId(campaignId, connection);
            if (keys.length < 2) {
                throw new Error("รอบสอบนี้ยังไม่ได้สร้างคีย์ครับ 2 คีย์");
            }
            const keyFirst = keys.find(k => k.order_num === 1);
            const keySecond = keys.find(k => k.order_num === 2);

            if (!keyFirst || !keySecond) {
                throw new Error("คีย์สำหรับรอบสอบนี้ไม่ครบ 2 คีย์");
            }
            const decryptedKey1Buffer = aesDecrypt(Buffer.from(keyFirst.key, CIPHER_ENCODING), Buffer.from(process.env.MASTER_KEY!, PAYLOAD_ENCODING), STATIC_IV_BUFFER);
            const decryptedKey1 = decryptedKey1Buffer.toString(PAYLOAD_ENCODING);
            console.log("Decrypted Key 1 for verification:", decryptedKey1);
            const decryptedKey2Buffer = aesDecrypt(Buffer.from(keySecond.key, CIPHER_ENCODING), Buffer.from(process.env.MASTER_KEY!, PAYLOAD_ENCODING), STATIC_IV_BUFFER);
            const decryptedKey2 = decryptedKey2Buffer.toString(PAYLOAD_ENCODING);
            console.log("Decrypted Key 2 for verification:", decryptedKey2);
            return { decryptedKey1, decryptedKey2 };
        }
        catch (error) {
            console.error("Service Error (Decryption for Unlock):", error);
            throw new Error("ถอดรหัสล้มเหลว");
        }
    }

    static decryptQrPayloadConnection = async (
        ciphertext: string,
        campaignId: number,
        connection: PoolConnection
    ) => {
        let flag_qr_inactive = false
        try {
            const activeCamp = await campaignRepo.IscampaignActive(campaignId, connection);
            if (!activeCamp) {
                throw new Error(`ไม่สามารถสแกนคิวอาร์โค้ดได้เนื่องจากรอบสอบนี้ยังไม่เปิดใช้งาน`);
            }
            const isQrActive = await settingsRepo.QRStatus(campaignId, connection);
            if (!isQrActive) {
                flag_qr_inactive = true;
                throw new Error("ไม่สามารถสแกนคิวอาร์โค้ดได้เนื่องจากระบบสแกนคิวอาร์โค้ดถูกปิดใช้งานอยู่");
            }
            console.log("QR Status:", isQrActive);
            // 1. ดึงคีย์ (เหมือนเดิม)
            const keys = await keyRepo.findAllByCampaignId(campaignId, connection);
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

            const decryptedKey1Buffer = aesDecrypt(Buffer.from(key1.key, CIPHER_ENCODING), Buffer.from(process.env.MASTER_KEY!, PAYLOAD_ENCODING), STATIC_IV_BUFFER);
            const decryptedKey2Buffer = aesDecrypt(Buffer.from(key2.key, CIPHER_ENCODING), Buffer.from(process.env.MASTER_KEY!, PAYLOAD_ENCODING), STATIC_IV_BUFFER);
            const key1Buffer = Buffer.from(decryptedKey1Buffer.toString(PAYLOAD_ENCODING), PAYLOAD_ENCODING);
            const key2Buffer = Buffer.from(decryptedKey2Buffer.toString(PAYLOAD_ENCODING), PAYLOAD_ENCODING);

            console.log(decryptedKey1Buffer.toString(PAYLOAD_ENCODING), decryptedKey2Buffer.toString(PAYLOAD_ENCODING))
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
        } catch (error: any) {
            console.error("Service Error (Decryption):", error);

            if (flag_qr_inactive) {
                throw new Error("ไม่สามารถสแกนคิวอาร์โค้ดได้เนื่องจากระบบสแกนคิวอาร์โค้ดถูกปิดใช้งานอยู่");

            }

            throw new Error("ไม่สามารถถอดรหัสได้ เนื่องจากข้อมูลไม่ถูกต้องหรือคีย์ไม่ครบถ้วน");
        }
    };

    static GetDashBoard = async (campaign_id: number) => {
        const importStatus = await dashboardRepo.getStatusSession(Number(campaign_id));
        const encryptedStatus = await dashboardRepo.getIsEncrypted(Number(campaign_id));
        const subjectsQuestions = await dashboardRepo.getSubjectQuestionsByCampaign(Number(campaign_id));
        const sessionDates = await keyRepo.GetSessionDate(Number(campaign_id)); // << ควรมี session_id + session_code
        const keyStatus = await keyRepo.KeyStatus(Number(campaign_id));
        console.log("Dashboard Data Retrieved:", {
            importStatus,
            encryptedStatus,
            subjectsQuestions,
            sessionDates,
            keyStatus,
        });

        // --- helper ---
        const toNumber = (v: any, fallback = 0) => {
            const n = Number(v);
            return Number.isFinite(n) ? n : fallback;
        };

        // ทำ index หา session ได้เร็ว
        const sessionDateMap = new Map<number, any>();
        for (const d of sessionDates ?? []) {
            sessionDateMap.set(d.session_id, d);
        }

        // เผื่อ sessionDates ไม่มี session_code ให้ดึงจาก importStatus
        const sessionCodeMap = new Map<number, string>();
        for (const s of importStatus ?? []) {
            sessionCodeMap.set(s.session_id, s.session_code);
        }

        // --- GROUP: session -> subjects -> questions ---
        const sessions: Record<number, any> = {};

        for (const r of subjectsQuestions ?? []) {
            const sid = Number(r.session_id);
            const subjId = Number(r.subject_id);

            if (!sessions[sid]) {
                const d = sessionDateMap.get(sid);
                sessions[sid] = {
                    session_id: sid,
                    session_code: d?.session_code ?? sessionCodeMap.get(sid) ?? `Session ${sid}`,
                    exam_date: d?.exam_date ?? r.exam_date ?? null,
                    start_at: d?.start_at ?? r.start_at ?? null,
                    end_at: d?.end_at ?? r.end_at ?? null,
                    subjects: [] as any[],
                };
            }

            let subj = sessions[sid].subjects.find((x: any) => x.subject_id === subjId);
            if (!subj) {
                subj = {
                    subject_id: subjId,
                    subject_code: r.subject_code,
                    subject_name: r.subject_name,
                    questions: [] as any[],
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
        Object.values(sessions).forEach((sess: any) => {
            sess.subjects.forEach((subj: any) => {
                subj.questions.sort((a: any, b: any) => a.questionNo - b.questionNo);
            });
            sess.subjects.sort((a: any, b: any) => String(a.subject_code).localeCompare(String(b.subject_code)));
        });

        return {
            importStatus,
            encryptedStatus,
            keyStatus,
            sessionDates,
            subjectsQuestions,
            sessions,
        };
    };

    static getForgetKey = async (campaign_id: number, key_id: number, account_id: number, password: string) => {
        const keyData = await keyRepo.findKeys(key_id, campaign_id);
        console.log("Key Data Retrieved:", keyData);
        console.log("Provided Account ID:", account_id);
        const key = keyData?.key;
        if (!keyData) {
            throw new Error("ไม่พบคีย์ที่ต้องการดึงข้อมูล");
        }
        if (Number(keyData.account_id) !== Number(account_id)) {
            throw new Error("คุณไม่มีสิทธิ์ในการดึงข้อมูลคีย์นี้เนื่องจากคุณไม่ได้เป็นเจ้าของคีย์");
        }
        if (!key) {
            throw new Error("ไม่พบคีย์ที่ต้องการดึงข้อมูล");
        }

        const isPasswordValid = await authservice.CheckPasswordByID(account_id, password)
        console.log(isPasswordValid)
        if (!isPasswordValid) {
            throw new Error("รหัสผ่านไม่ถูกต้อง");
        }
        if (isPasswordValid.active === 0) {
            throw new Error("บัญชีถูกระงับการใช้งาน");
        }
        if (isPasswordValid.roles[0] !== "manager") {
            throw new Error("คุณไม่มีสิทธิ์ในการดึงข้อมูลคีย์นี้เนื่องจากคุณไม่ใช่ผู้จัดการคีย์");
        }

        const decryptedKey1Buffer = aesDecrypt(Buffer.from(key, CIPHER_ENCODING), Buffer.from(process.env.MASTER_KEY!, PAYLOAD_ENCODING), STATIC_IV_BUFFER);
        console.log("Decrypted Key for verification:", decryptedKey1Buffer.toString(PAYLOAD_ENCODING));
        return decryptedKey1Buffer.toString(PAYLOAD_ENCODING);
    }

    static encryptForPrint = (realQrPayload: string): string => {
        const scanKey = Buffer.from(process.env.SCAN_SECRET_KEY || "SuperSecretScanK", "utf8");
        const scanIv = STATIC_IV_BUFFER;
        const plainBuffer = Buffer.from(realQrPayload, "utf8");
        const cipherBuffer = aesEncrypt(plainBuffer, scanKey, scanIv);

        return cipherBuffer.toString("base64");
    };

    static maskQrPayload = (realPayload: string): string => {
        // 🛑 เปลี่ยนจาก 'utf8' เป็น 'base64' เพื่อให้ความยาวไม่บวม
        const textBuffer = Buffer.from(realPayload, 'base64');
        const keyBuffer = Buffer.from(this.MASKING_KEY, 'utf8');
        const resultBuffer = Buffer.alloc(textBuffer.length);

        for (let i = 0; i < textBuffer.length; i++) {
            resultBuffer[i] = textBuffer[i] ^ keyBuffer[i % keyBuffer.length];
        }

        // คืนค่ากลับเป็น Base64
        return resultBuffer.toString('base64');
    };

    /**
     * 2. ถอดหน้ากาก: รับค่า Base64 จากสแกนเนอร์ -> คืนค่า Base64 ของจริงไปค้น DB
     */
    static unmaskQrPayload = (scannedText: string): string => {
        try {
            // 🛑 ใช้ logic เดียวกันเป๊ะ เพราะ XOR สลับไปสลับมาได้เลย
            const maskedBuffer = Buffer.from(scannedText, 'base64');
            const keyBuffer = Buffer.from(this.MASKING_KEY, 'utf8');
            const resultBuffer = Buffer.alloc(maskedBuffer.length);

            for (let i = 0; i < maskedBuffer.length; i++) {
                resultBuffer[i] = maskedBuffer[i] ^ keyBuffer[i % keyBuffer.length];
            }

            // 🛑 เปลี่ยนเป็น 'base64' เพื่อให้ได้หน้าตาเหมือนข้อมูลจริงใน DB เป๊ะๆ
            return resultBuffer.toString('base64');
        } catch (error) {
            throw new Error("❌ คิวอาร์โค้ดนี้ไม่ใช่ของระบบ หรือสแกนผิดพลาด");
        }
    };
}


