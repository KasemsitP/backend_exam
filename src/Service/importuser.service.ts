import { DB } from "../model/DB";
import userImportRepo from "../Repo/importuser.repo";
import sessionRepo from "../Repo/session.repo"; // (Repo ที่มีอยู่)

// (Interface ที่ตรงกับ 'ImportResponse' ใน Slice)
interface ImportResponse {
  totalUsersCreated: number;
  totalUsersFound: number;
  totalCampaignLinks: number;
  totalSessionLinks: number;
}

export class userImportService {
  static importUsersToCampaign = async (
    campaignId: number,
    rows: Record<string, string>[]
  ): Promise<ImportResponse> => {
    const connection = await DB.getInstance().getConnection();
    let stats: ImportResponse = {
      totalUsersCreated: 0,
      totalUsersFound: 0,
      totalCampaignLinks: 0,
      totalSessionLinks: 0,
    };
    try {
      await connection.beginTransaction();

      const sessions = await sessionRepo.findAllLiteByCampaignId(
        campaignId,
        connection
      );

      if (sessions.length === 0) {
        console.warn(`Campaign ID ${campaignId} has no sessions to link.`);
      }

      let generatedRunning = 1;

      for (const row of rows) {
        let userCode = undefined;
        if (!userCode) {
          userCode = String(generatedRunning).padStart(4, "0");
          generatedRunning++;
        }

        const title =
          row.title ??
          row["คำนำหน้า"] ??
          row["prefix"]; 

        const firstName =
          row.first_name ??
          row.firstName ??
          row["ชื่อ"] ??
          row["first name"];

        const lastName =
          row.last_name ??
          row.lastName ??
          row["นามสกุล"] ??
          row["last name"];

        const fullName = [firstName, lastName]
          .filter((v) => v && String(v).trim() !== "")
          .join(" ")
          .trim();

        if (!userCode || !fullName) {
          console.warn("Skipping row, missing user_code or full_name:", row);
          continue;
        }

        const { user, created: userCreated } =
          await userImportRepo.findOrCreateUser(
            { user_code: userCode, full_name: fullName ,first_name: firstName , last_name: lastName , title : title},
            connection
          );

        if (userCreated) stats.totalUsersCreated++;
        else stats.totalUsersFound++;

        const { userCampaign, created: campaignLinkCreated } =
          await userImportRepo.findOrCreateUserCampaign(
            { user_id: user.id, campaign_id: campaignId },
            connection
          );
        if (campaignLinkCreated) stats.totalCampaignLinks++;

        for (const session of sessions) {
          const { created: sessionLinkCreated } =
            await userImportRepo.findOrCreateUserSession(
              {
                user_campaign_id: userCampaign.id,
                session_id: session.id,
                campaign_id: campaignId,
                // ถ้า user_sessions ยังต้องใช้ site_id อยู่
                // site_id: session.site_id,
              },
              connection
            );
          if (sessionLinkCreated) stats.totalSessionLinks++;
        }
      }

      await connection.commit();
      return stats;
    } catch (error) {
      await connection.rollback();
      console.error("Import Error (Service):", error);
      throw error;
    } finally {
      connection.release();
    }
  };
}
