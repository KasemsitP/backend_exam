import campaignRepo from "../Repo/campaign.repo";
import sessionRepo from "../Repo/session.repo";
import { DB } from "../model/DB";
import { ApiCampaign, CreateCampaignPayload } from "../Repo/campaign.repo";

export class campaignService {
  static create = async (payload: CreateCampaignPayload): Promise<ApiCampaign> => {
    const checkCampActive = await campaignRepo.CheckActiveCamp()
    if (checkCampActive && payload.is_active) {
      throw new Error("มีรอบสอบที่เปิดใช้งานอยู่แล้ว ไม่สามารถสร้างรอบสอบใหม่ได้");
    }
    console.log(payload)
    const newCampaign = await campaignRepo.create(payload);
    return newCampaign;
  };

  static update = async (payload: CreateCampaignPayload): Promise<ApiCampaign> => {
    const updatedCampaign = await campaignRepo.update(payload);
    return updatedCampaign;
  };

  static delete = async (id: number): Promise<boolean> => {
    const connection = await DB.getInstance().getConnection();

    try {
      await connection.beginTransaction();
      await sessionRepo.deleteByCampaignId(id, connection);
      const deleted = await campaignRepo.delete(id, connection);

      await connection.commit();

      if (!deleted) {
        throw new Error(`Failed to delete Campaign ID ${id} or not found.`);
      }
      return true;
    } catch (error) {
      await connection.rollback();
      console.error(
        "Service Error: Failed to delete campaign and sessions",
        error
      );
      throw error;
    } finally {
      connection.release();
    }
  };
  static getIsUnlock = async (campaign_id: number) => {
    return await campaignRepo.getIsDecrypted(campaign_id)
  }
}

