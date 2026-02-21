import { DB } from "../model/DB";
import userImportRepo from "../Repo/importuser.repo";
import sessionRepo from "../Repo/session.repo"; // (Repo ที่มีอยู่)
import shuffle from "lodash.shuffle";
import { chunk } from "lodash";

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

    const sessions = await sessionRepo.findAllLiteByCampaignId(campaignId, connection);
    if (sessions.length === 0) {
      console.warn(`Campaign ID ${campaignId} has no sessions to link.`);
    }
    const previsNumber = await userImportRepo.findPreviousNumber(campaignId, connection);
    const currentMax = await userImportRepo.findMaxUserCodeByCampaign(campaignId, connection);
    console.log(`Current max user_code for campaign ${campaignId}:`, currentMax);
    let generatedRunning = currentMax + 1;
    let skipped = 0;

    const shuffledRows = shuffle(rows);

    // ------------------------------------------------------------------
    // Phase 1: เตรียมข้อมูลทั้งหมดไว้ใน Memory ก่อน
    // ------------------------------------------------------------------
    const processedData = [];

    for (const row of shuffledRows) {
      const firstName = row.firstname ?? row.first_name ?? row.firstName ?? row["ชื่อ"] ?? row["first name"];
      const lastName = row.lastname ?? row.last_name ?? row.lastName ?? row["นามสกุล"] ?? row["last name"];
      const title = row.title ?? row["คำนำหน้า"] ?? row["prefix"];

      const fullName = [firstName, lastName]
        .filter((v) => v && String(v).trim() !== "")
        .join(" ")
        .trim();

      if (!fullName) {
        skipped++;
        continue;
      }

      // จัดการ userCode แบบ Sync ล่วงหน้า ป้องกันปัญหา Race Condition เวลาทำ Promise.all
      let userCode = String(generatedRunning);
      generatedRunning++; 

      const nationalId = row.national_id ?? row["national_id"] ?? row["citizen_id"] ?? row["เลขบัตรประชาชน"] ?? row["เลขประจำตัวประชาชน"] ?? row["id_card"] ?? null;
      const birthDateRaw = row.dateofbirth ?? row.birth_date ?? row["birth date"] ?? row["วันเกิด"] ?? row["วัน/เดือน/ปีเกิด"] ?? null;
      const birthDate = normalizeDate(birthDateRaw);

      processedData.push({
        userCode,
        fullName,
        firstName,
        lastName,
        title,
        nationalId,
        birthDate
      });
    }

    // ------------------------------------------------------------------
    // Phase 2: ยิง Database แบบ Concurrency (แบ่ง Chunk เพื่อไม่ให้ DB ค้าง)
    // ------------------------------------------------------------------
    const CHUNK_SIZE = 50; // ปรับขนาด Chunk ได้ตามความเหมาะสมของ Database (เช่น 50-100)
    const rowChunks = chunk(processedData, CHUNK_SIZE); 

    for (const batch of rowChunks) {
      // ประมวลผลแต่ละ Chunk ขนานกัน
      await Promise.all(
        batch.map(async (data) => {
          // 1. จัดการ User
          const { user, created: userCreated } = await userImportRepo.findOrCreateUser({
            user_code: data.userCode,
            full_name: data.fullName,
            first_name: data.firstName,
            last_name: data.lastName,
            title: data.title,
            national_id: data.nationalId,
            birth_date: data.birthDate,
          }, connection);

          if (userCreated) stats.totalUsersCreated++;
          else stats.totalUsersFound++;

          // 2. จัดการ Campaign Link
          const { userCampaign, created: campaignLinkCreated } = await userImportRepo.findOrCreateUserCampaign({ 
            user_id: user.id, 
            campaign_id: campaignId 
          }, connection);
          
          if (campaignLinkCreated) stats.totalCampaignLinks++;

          // 3. จัดการ Session Links แบบขนาน
          if (sessions.length > 0) {
            await Promise.all(
              sessions.map(async (session) => {
                const { created: sessionLinkCreated } = await userImportRepo.findOrCreateUserSession({
                  user_campaign_id: userCampaign.id,
                  session_id: session.id,
                  campaign_id: campaignId,
                }, connection);
                
                if (sessionLinkCreated) stats.totalSessionLinks++;
              })
            );
          }
        })
      );
    }

    if (skipped > 0) {
      console.warn(`Skipped ${skipped} rows (missing full_name)`);
    }

    await connection.commit();
    stats.totalUsersFound = previsNumber
    stats.totalUsersCreated = previsNumber + stats.totalCampaignLinks
    return stats;

  } catch (error) {
    await connection.rollback();
    console.error("Import failed, transaction rolled back:", error);
    throw error;
  }
};
}
