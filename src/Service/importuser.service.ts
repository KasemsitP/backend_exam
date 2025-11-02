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

      // [ ⭐️ 1. แก้ไข: ดึง Session (id และ site_id) ⭐️ ]
      // (เปลี่ยนจาก findAllIdsByCampaignId -> findAllLiteByCampaignId)
      const sessions = await sessionRepo.findAllLiteByCampaignId(
        campaignId,
        connection
      );

      if (sessions.length === 0) {
        console.warn(`Campaign ID ${campaignId} has no sessions to link.`);
      }

      // 2. วน Loop ผู้ใช้ (Rows)
      for (const row of rows) {
        
        // (ส่วนนี้ถูกต้องแล้ว)
        const userCode =
          row.user_code ??
          row.nationalId ??
          row["รหัสประจำตัวประชาชน"] ??
          row["เลขบัตรประชาชน"] ??
          row.number;
        
        const fullName =
          row.full_name ??
          row.Player ??
          `${row.firstName ?? row["ชื่อ"]} ${row.lastName ?? row["นามสกุล"]}`;

        if (!userCode || !fullName || fullName.trim() === "") {
          console.warn("Skipping row, missing user_code or full_name:", row);
          continue;
        }

        // 3. Find/Create User (ตาราง 'users')
        const { user, created: userCreated } =
          await userImportRepo.findOrCreateUser(
            { user_code: userCode, full_name: fullName.trim() },
            connection
          );
        if (userCreated) stats.totalUsersCreated++;
        else stats.totalUsersFound++;

        // 4. Find/Create UserCampaign (เชื่อม 'users' ↔ 'exam_campaigns')
        const { userCampaign, created: campaignLinkCreated } =
          await userImportRepo.findOrCreateUserCampaign(
            { user_id: user.id, campaign_id: campaignId },
            connection
          );
        if (campaignLinkCreated) stats.totalCampaignLinks++;

        // [ ⭐️ 2. แก้ไข: วน Loop (Sessions) ⭐️ ]
        // (เปลี่ยนจาก sessionId -> session)
        for (const session of sessions) {
          
          // 6. Find/Create UserSession (เชื่อม 'user_campaigns' ↔ 'sessions')
          
          // [ ⭐️ 3. แก้ไข: เพิ่ม site_id ⭐️ ]
          // (ส่ง site_id ไปให้ Repo เพื่อแก้ Error)
          const { created: sessionLinkCreated } =
            await userImportRepo.findOrCreateUserSession(
              {
                user_campaign_id: userCampaign.id,
                session_id: session.id, // 👈 (ใช้ session.id)
                campaign_id: campaignId,
                site_id: session.site_id, // 👈 (เพิ่ม site_id)
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

