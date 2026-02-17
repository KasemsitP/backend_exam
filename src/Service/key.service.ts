import { DB } from "../model/DB";
import keyRepo from "../Repo/key.repo";
import crypto from "crypto";
import userImportRepo from "../Repo/importuser.repo";
import { PoolConnection } from "mysql2/promise";
import dashboardRepo from "../Repo/dashboard.repo";

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

    static runBulkEncryptionForSession = async (
        campaignId: number,
    ) => {
        const countkeys = await keyRepo.countByCampaignId(campaignId);
        if (countkeys < 1) {
            throw new Error("ไม่สามารถทำการเข้ารหัสได้เนื่องจากรอบสอบนี้มีคีย์ไม่ครบ 2 คีย์");
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

            console.log(keyFirst, keySecond)

            if (!keyFirst || !keySecond) {
                throw new Error("คีย์สำหรับรอบสอบนี้ไม่ครบ 2 คีย์");
            }
            const decryptedKey1Buffer = aesDecrypt(Buffer.from(keyFirst.key, CIPHER_ENCODING), Buffer.from(process.env.MASTER_KEY!, PAYLOAD_ENCODING), STATIC_IV_BUFFER);
            const decryptedKey1 = decryptedKey1Buffer.toString(PAYLOAD_ENCODING);
            console.log("Decrypted Key 1 for verification:", decryptedKey1);

            const decryptedKey2Buffer = aesDecrypt(Buffer.from(keySecond.key, CIPHER_ENCODING), Buffer.from(process.env.MASTER_KEY!, PAYLOAD_ENCODING), STATIC_IV_BUFFER);
            const decryptedKey2 = decryptedKey2Buffer.toString(PAYLOAD_ENCODING);
            console.log("Decrypted Key 2 for verification:", decryptedKey2);

            console.log(campaignId)
            // const [key1, key2] = keys;
            const key1Buffer = Buffer.from(decryptedKey1, PAYLOAD_ENCODING);
            const key2Buffer = Buffer.from(decryptedKey2, PAYLOAD_ENCODING);

            // Static IV Buffer ที่กำหนดไว้
            const iv1Buffer = STATIC_IV_BUFFER;
            const iv2Buffer = STATIC_IV_BUFFER; // (ใช้ตัวเดียวกันสำหรับ Layer 2 ตามโค้ด Demo)
            for (const sessionId of sessionIds) {

                const allUserLinks =
                    await userImportRepo.findAllUserLinksForSession(
                        sessionId,
                        connection
                    );

                if (allUserLinks.length === 0) {
                    console.warn(`No users found for session ${sessionId}`);
                    throw new Error(`users in some session not imported yet ${sessionId}`);
                }
                console.log(`Encrypting ${allUserLinks.length} users for session ${sessionId}`);

                for (const userLink of allUserLinks) {

                    const payload = {
                        cid: campaignId,
                        sid: sessionId,
                        uid: userLink.user_id,
                    };

                    const plainTextBuffer = Buffer.from(
                        JSON.stringify(payload),
                        PAYLOAD_ENCODING
                    );

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
        try {
            // 1. ดึงคีย์ (เหมือนเดิม)
            const keys = await keyRepo.findAllByCampaignId(campaignId);
            if (keys.length !== 2) {
                throw new Error("Decryption failed: Campaign must have exactly 2 keys.");
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
        } catch (error) {
            console.error("Service Error (Decryption):", error);
            throw new Error("Decryption failed. Invalid payload or keys.");
        }
    };

    static decrypteKeyForUnlock = async (campaignId: number, connection: PoolConnection) => {
        try {
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
        try {
            // 1. ดึงคีย์ (เหมือนเดิม)
            const keys = await keyRepo.findAllByCampaignId(campaignId);
            if (keys.length !== 2) {
                throw new Error("Decryption failed: Campaign must have exactly 2 keys.");
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
        } catch (error) {
            console.error("Service Error (Decryption):", error);
            throw new Error("Decryption failed. Invalid payload or keys.");
        }
    };

    static GetDashBoard = async (campaign_id: number) => {
        const importStatus = await dashboardRepo.getStatusSession(Number(campaign_id));
        const encryptedStatus = await dashboardRepo.getIsEncrypted(Number(campaign_id));
        const subjectsQuestions = await dashboardRepo.getSubjectQuestionsByCampaign(Number(campaign_id));
        const sessionDates = await keyRepo.GetSessionDate(Number(campaign_id)); // << ควรมี session_id + session_code
        const keyStatus = await keyRepo.KeyStatus(Number(campaign_id));

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
            sessionDates,       // จะคงไว้ก็ได้
            subjectsQuestions,  // จะคงไว้ก็ได้ (ไว้ debug)
            sessions,           // ✅ ตัวใหม่ที่ UI ใช้ง่ายสุด
        };
    };

}


