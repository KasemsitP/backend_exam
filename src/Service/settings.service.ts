import { DB } from "../model/DB";
import settingsRepo from "../Repo/settings.repo";
import examDataRepo from "../Repo/exam.repo";
import keyRepo from "../Repo/key.repo";

export class SettingService {

    static ActiveInActiveCampaign = async (campaign_id: number) => {
        const conn = await DB.getInstance().getConnection();
        try {
            await conn.beginTransaction();

            const examLists = await examDataRepo.CampaignLists(conn);
            const is_active = await examDataRepo.Checkactive(conn, campaign_id);

            const current_active = examLists.find((row) => row.is_active === 1);

            if (is_active === 0) {
                if (current_active && current_active.id !== campaign_id) {

                    throw new Error("มีรอบสอบที่เปิดใช้งานอยู่แล้ว กรุณาปิดรอบสอบเดิมก่อน");
                }
                await examDataRepo.UpdateExamActive(conn, campaign_id);
            } else {
                await examDataRepo.UpdateExamNoActive(conn, campaign_id);
            }

            await conn.commit();
        } catch (error) {
            await conn.rollback();
            console.error("ไม่สามารถเปิด-ปิดรอบสอบได้", error);
            throw error;
        } finally {
            conn.release();
        }
    };

    static async ActiveInActiveQR(campaign_id: number) {
        const conn = await DB.getInstance().getConnection();
        try {
            await conn.beginTransaction();

         //   const examLists = await examDataRepo.CampaignLists(conn);
            const qr_active = await examDataRepo.CheckQRactive(conn, campaign_id);
            if(qr_active === true ){
                await examDataRepo.UpdateQRNoActive(conn, campaign_id);
            }
            else{
                await examDataRepo.UpdateQRActive(conn, campaign_id);
            }

            await conn.commit();
        } catch (error) {
            await conn.rollback();
            console.error("ไม่สามารถเปิด-ปิดรอบสอบได้", error);
            throw error;
        } finally {
            conn.release();
        }
    }

    static async getSettingStatus(campaign_id: number) {
        const conn = await DB.getInstance().getConnection();
        try {
            await conn.beginTransaction();
            const campStatus = await settingsRepo.CampStatus(campaign_id, conn);
            const keysStatus = await settingsRepo.QRStatus(campaign_id, conn);
            await conn.commit();
            return {
                campStatus: campStatus,
                QRStatus: keysStatus
            }

        } catch (error) {
            await conn.rollback();
            console.error("ไม่สามารถเปิดใช้รอบสอบได้", error);
            throw error;

        }
        finally {
            conn.release();
        }
    }

}
