import { DB } from "../model/DB";
import * as keyService from "./key.service";
import userSessionsRepo from "../Repo/user-session.repo";
import bookletsRepo from "../Repo/booklets.repo";
import campaignRepo from "../Repo/campaign.repo";

interface VerifyQrPayload {
    qrPayload: string; // รับค่าที่สวมหน้ากากมาจาก Frontend
    campaignId: string;
}

function parseId(id: string | number): number {
    if (typeof id === "number") return id;
    return parseInt(id.replace(/\D/g, ""));
}

export class verifyService {


    static verifyQrPayload = async (payload: VerifyQrPayload) => {
        const connection = await DB.getInstance().getConnection();
        try {
            const campaignIdNumeric = parseId(payload.campaignId);
            
   
            const realQrPayload = keyService.keyService.unmaskQrPayload(payload.qrPayload);

            const isActiveCamp = await campaignRepo.IscampaignActive(campaignIdNumeric, connection);
            if (!isActiveCamp) {
                throw new Error(`รอบสอบนี้ยังไม่เปิดใช้งาน`);
            }

        
            const decryptedPayload = await keyService.keyService.decryptQrPayload(
                realQrPayload,
                campaignIdNumeric,
            );

            if (!decryptedPayload || !decryptedPayload.uid || !decryptedPayload.sid) {
                throw new Error(`QR Code ไม่ถูกต้อง หรือถอดรหัสล้มเหลว`);
            }

            if (decryptedPayload.cid !== campaignIdNumeric) {
                throw new Error(`สมุดเล่มนี้อยู่คนละรอบสอบปัจจุบัน กรุณาติดต่อเจ้าหน้าที่`);
            }

    
            const userSession = await userSessionsRepo.findByUserCodeAndSessionIdForQRcode(
                decryptedPayload.uid,
                decryptedPayload.sid,
                connection
            );

            if (!userSession) {
                throw new Error(`ไม่พบข้อมูลผู้สอบ (UserCode: ${decryptedPayload.uid})`);
            }

            return {
                ...userSession,
                session_id: decryptedPayload.sid
            };

        } catch (error) {
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


            const realQrPayload = keyService.keyService.unmaskQrPayload(qr_payload);

            const isActiveCamp = await campaignRepo.IscampaignActive(campaignIdNumeric, connection);
            if (!isActiveCamp) {
                throw new Error(`รอบสอบนี้ยังไม่เปิดใช้งาน`);
            }


            const bookletData = await bookletsRepo.findBookletsbyQRpayloadandBookletsID(
                connection, 
                realQrPayload, 
                booklets_id
            );

            if (!bookletData) {
                throw new Error(`ข้อมูลสมุดคำตอบไม่ถูกต้อง หรือไม่มีรายการที่ต้องตรวจสอบเพิ่ม`);
            }


            const userSessionWithExtra = {
                booklets_id: bookletData.random_num, 
                subject_name: bookletData.subject_name,
                bag_no: bookletData.bag_no,
            };

            return { success: true, data: userSessionWithExtra };

        } catch (error) {
            console.error("Service Error (Check Orders):", error);
            throw error;
        } finally {
            connection.release();
        }
    };
}