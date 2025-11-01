import campaignRepo from "../Repo/campaign.repo";
import sessionRepo from "../Repo/session.repo";
import { DB } from "../model/DB";
// [FIX] แก้ไข Import ให้นำเข้า Type จากไฟล์ types.ts
import { ApiCampaign, CreateCampaignPayload } from "../Repo/campaign.repo";

export class campaignService {
  static create = async (payload: CreateCampaignPayload): Promise<ApiCampaign> => {
    const newCampaign = await campaignRepo.create(payload);
    return newCampaign;
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
}

