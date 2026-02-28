import { DB } from "../model/DB";
import * as keyService from "./key.service";
import userSessionsRepo from "../Repo/user-session.repo"; // (Import Repo จาก Canvas)
import bookletsRepo from "../Repo/booklets.repo";
import campaignRepo from "../Repo/campaign.repo";

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

                        const isActiveCamp = await campaignRepo.IscampaignActive(campaignIdNumeric, connection);
                        if (!isActiveCamp) {
                                throw new Error(`รอบสอบนี้ยังไม่เปิดใช้งาน`);
                        }
                        console.log("TEST CAM", isActiveCamp)


                        const decryptedPayload = await keyService.keyService.decryptQrPayload(
                                payload.qrPayload,
                                campaignIdNumeric,
                        );
                        console.log(decryptedPayload)

                        if (!decryptedPayload || !decryptedPayload.uid || !decryptedPayload.sid) {
                                throw new Error(`QR Code ไม่ถูกต้อง หรือถอดรหัสล้มเหลว`);
                        }
                        console.log(decryptedPayload)

                        if (decryptedPayload.cid !== campaignIdNumeric) {
                                throw new Error(`สมุดเล่มนี้อยู่คนละรอบสอบปัจจุบัน กรุณาติดต่อเจ้าหน้าที่`);
                        }


                        // 3. ดึงข้อมูลผู้สอบ (ใช้ฟังก์ชันใน Canvas)
                        const userSession = await userSessionsRepo.findByUserCodeAndSessionIdForQRcode(
                                decryptedPayload.uid,
                                decryptedPayload.sid,
                                connection
                        );

                        if (!userSession) {
                                throw new Error(`ไม่พบข้อมูลผู้สอบ (UserCode: ${decryptedPayload.uid})`);
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
        static checkBookletsOrders = async (campaign_id: number, qr_payload: string, booklets_id: number) => {
                const connection = await DB.getInstance().getConnection();
                try {
                        const campaignIdNumeric = parseId(campaign_id);
                        console.log(qr_payload, campaignIdNumeric)

                        const isActiveCamp = await campaignRepo.IscampaignActive(campaignIdNumeric, connection);
                        if (!isActiveCamp) {
                                throw new Error(`รอบสอบนี้ยังไม่เปิดใช้งาน`);
                        }

                        const decryptedPayload = await bookletsRepo.findBookletsbyQRpayloadandBookletsID(connection, qr_payload, booklets_id);
                        console.log(decryptedPayload)


                        if (!decryptedPayload) {
                                throw new Error(`สมุดเล่มนี้ไม่ใช่สมุดที่มีคะแนนเกิน 4 คะแนน`);
                        }

                        console.log(decryptedPayload)

                        // 3. ดึงข้อมูลผู้สอบ (ใช้ฟังก์ชันใน Canvas)
                        // const userSession = await userSessionsRepo.findByUserCodeAndSessionIdForQRcode(
                        //         decryptedPayload.uid,
                        //         decryptedPayload.sid,
                        //         connection
                        // );
                        // console.log(userSession)
                        // if (!userSession) {
                        //         throw new Error(`ไม่พบข้อมูลผู้สอบ (UserCode: ${decryptedPayload.uid})`);
                        // }

                        // const booklets = await bookletsRepo.findBookletsbyQRpayload(
                        //         connection,
                        //         decryptedPayload.cid,
                        //         decryptedPayload.sid,
                        //         decryptedPayload.uid
                        // );        
                        // const booklets = [ {}]             
                        // if (!booklets || booklets.length === 0) {
                        //         throw new Error(`ไม่พบสมุดคำตอบที่ตรงกับคิวอาร์โค้ดนี้`);
                        // }
                        // const bookletsQR_id = booklets.booklet_id 
                        // if(bookletsQR_id !== booklets_id) {
                        //         throw new Error(`สมุดคำตอบนี้ไม่ตรงกับคิวอาร์โค้ดนี้`);
                        // }

                        const userSessionWithExtra = {
                                booklets_id: decryptedPayload.random_num,
                                subject_name: decryptedPayload.subject_name,
                                bag_no: decryptedPayload.bag_no,
                        };

                         console.log(userSessionWithExtra)
                        return { success: true, data: userSessionWithExtra }

                } catch (error) {
                        console.error("Service Error (Verify QR):", error);
                        throw error;
                } finally {
                        connection.release();
                }
        };
}