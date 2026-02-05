import { DB } from "../model/DB";
import userImportRepo from "../Repo/importuser.repo";
import sessionRepo from "../Repo/session.repo"; // (Repo ที่มีอยู่)
import shuffle from "lodash.shuffle";

// (Interface ที่ตรงกับ 'ImportResponse' ใน Slice)
interface ImportResponse {
  totalUsersCreated: number;
  totalUsersFound: number;
  totalCampaignLinks: number;
  totalSessionLinks: number;
}
function normalizeDate(input: any): string | null {
  if (!input) return null;

  const raw = String(input).trim();

  // Excel serial date (เช่น 45123)
  if (/^\d{5}$/.test(raw)) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(excelEpoch.getTime() + Number(raw) * 86400000);
    return d.toISOString().slice(0, 10);
  }

  // DD/MM/YYYY หรือ DD-MM-YYYY
  const m1 = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (m1) {
    let [, dd, mm, yyyy] = m1;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }

  // YYYY-MM-DD (ISO)
  const m2 = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m2) {
    return raw;
  }

  // พยายาม parse ISO / Date string
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }

  // ❗ parse ไม่ได้ → return null เท่านั้น
  return null;
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

      const currentMax = await userImportRepo.findMaxUserCodeByCampaign(
        campaignId,
        connection
      );

      let generatedRunning = currentMax + 1;
      let skipped = 0;

      const shuffledRows = shuffle(rows);
      console.log("Shuffled Rows:", shuffledRows);

      for (const row of shuffledRows) {
        // 0) no (ลำดับในไฟล์) - เอาไว้อ้างอิง log เฉย ๆ ถ้าอยากใช้
        const rowNo =
          (row.no as any) ??
          (row["no"] as any) ??
          (row["ลำดับ"] as any) ??
          null;

        // 1) หา userCode (ถ้าไม่มีจากไฟล์ก็ gen)
        let userCode: string | undefined = undefined;

        // ถ้าอนาคตอยากอ่านจากไฟล์ก็เพิ่มเงื่อนไขตรงนี้ได้
        // userCode =
        //   (row.user_code as string) ??
        //   (row["user_code"] as string) ??
        //   (row["รหัสผู้เข้าสอบ"] as string);

        if (!userCode) {
          userCode = String(generatedRunning);
          generatedRunning++;
        }

        // 2) ชื่อ / นามสกุล / คำนำหน้า ตามที่คุณมีอยู่แล้ว
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

        if (!fullName) {
          skipped++;
          continue;
        }

        // 3) national_id
        const nationalId =
          row.national_id ??
          row["national_id"] ??
          row["citizen_id"] ??
          row["เลขบัตรประชาชน"] ??
          row["เลขประจำตัวประชาชน"] ??
          row["id_card"] ??
          null;

        // 4) birth_date (พยายาม normalize เป็น YYYY-MM-DD ถ้า parse ได้)
        const birthDateRaw =
          row.birth_date ??
          row["birth_date"] ??
          row["birth date"] ??
          row["วันเกิด"] ??
          row["วัน/เดือน/ปีเกิด"] ??
          null;

        const birthDate = normalizeDate(birthDateRaw);

        const { user, created: userCreated } =
          await userImportRepo.findOrCreateUser(
            {
              user_code: userCode,
              full_name: fullName,
              first_name: firstName,
              last_name: lastName,
              title: title,
              national_id: nationalId,
              birth_date: birthDate,
            },
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
              },
              connection
            );
          if (sessionLinkCreated) stats.totalSessionLinks++;
        }
      }

      if (skipped > 0) {
        console.warn(`Skipped ${skipped} rows (missing full_name)`);
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
