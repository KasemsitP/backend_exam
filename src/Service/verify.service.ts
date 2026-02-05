import { DB } from "../model/DB";
import * as keyService from "./key.service";
import userSessionsRepo from "../Repo/user-session.repo"; // (Import Repo จาก Canvas)

interface VerifyQrPayload {
        qrPayload: string;
        campaignId: string;
}

function parseId(id: string | number): number {
        if (typeof id === "number") {
                return id;
        }
        return parseInt(id.replace(/\D/g, ""));
}


export class verifyService {

        static verifyQrPayload = async (payload: VerifyQrPayload) => {
                const connection = await DB.getInstance().getConnection();
                try {
                        const campaignIdNumeric = parseId(payload.campaignId);
                        console.log(payload.qrPayload, campaignIdNumeric)


                        const decryptedPayload = await keyService.keyService.decryptQrPayload(
                                payload.qrPayload,
                                campaignIdNumeric,
                        );
                        console.log(decryptedPayload)

                        if (!decryptedPayload || !decryptedPayload.uid || !decryptedPayload.sid) {
                                throw new Error(`QR Code ไม่ถูกต้อง หรือถอดรหัสล้มเหลว`);
                        }
                        console.log(decryptedPayload)

                        // 3. ดึงข้อมูลผู้สอบ (ใช้ฟังก์ชันใน Canvas)
                        const userSession = await userSessionsRepo.findByUserCodeAndSessionIdForQRcode(
                                decryptedPayload.uid,
                                decryptedPayload.sid,
                                connection
                        );

                        if (!userSession) {
                                throw new Error(`ไม่พบข้อมูลผู้สอบ (UserCode: ${decryptedPayload.ucode})`);
                        }
                        const userSessionWithExtra = {
                                ...userSession,      
                                session_id: decryptedPayload.sid
                        };
                        console.log(userSessionWithExtra)
                        return userSessionWithExtra

                } catch (error) {
                        // (ไม่ต้อง Rollback เพราะนี่คือ Read-only)
                        console.error("Service Error (Verify QR):", error);
                        throw error;
                } finally {
                        connection.release();
                }
        };
}