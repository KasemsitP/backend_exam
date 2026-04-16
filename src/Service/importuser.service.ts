import { DB } from "../model/DB";
import userImportRepo from "../Repo/importuser.repo";
import sessionRepo from "../Repo/session.repo";
import shuffle from "lodash.shuffle";
import { chunk } from "lodash";
import { RowDataPacket } from "mysql2";

interface ImportResponse {
  totalUsersCreated: number;
  totalUsersFound: number;
  totalCampaignLinks: number;
  totalSessionLinks: number;
}

function normalizeDate(input: any): string | null {
  // ... (ฟังก์ชันเดิมของคุณ ดีอยู่แล้ว) ...
  if (!input) return null;
  const raw = String(input).trim();
  if (/^\d{5}$/.test(raw)) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(excelEpoch.getTime() + Number(raw) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const m1 = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (m1) {
    let [, dd, mm, yyyy] = m1;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  const m2 = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m2) {
    return raw;
  }
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  return null;
}

export class userImportService {
  // static importUsersToCampaign = async (
  //   campaignId: number,
  //   rows: Record<string, string>[]
  // ): Promise<ImportResponse> => {
  //   const connection = await DB.getInstance().getConnection();
  //   let stats: ImportResponse = {
  //     totalUsersCreated: 0,
  //     totalUsersFound: 0,
  //     totalCampaignLinks: 0,
  //     totalSessionLinks: 0,
  //   };

  //   try {
  //     await connection.beginTransaction();

  //     const sessions = await sessionRepo.findAllLiteByCampaignId(campaignId, connection);
  //     if (sessions.length === 0) {
  //       console.warn(`Campaign ID ${campaignId} has no sessions to link.`);
  //     }

  //     const previsNumber = await userImportRepo.findPreviousNumber(campaignId, connection);
  //     const currentMax = await userImportRepo.findMaxUserCodeByCampaign(campaignId, connection);

  //     let generatedRunning = currentMax + 1;
  //     let skipped = 0;
  //     const shuffledRows = shuffle(rows);

  //     // ------------------------------------------------------------------
  //     // Phase 1: เตรียมข้อมูลทั้งหมดไว้ใน Memory
  //     // ------------------------------------------------------------------
  //     const processedData = [];

  //     for (const row of shuffledRows) {
  //       const firstName = row.firstname ?? row.first_name ?? row.firstName ?? row["ชื่อ"] ?? row["first name"];
  //       const lastName = row.lastname ?? row.last_name ?? row.lastName ?? row["นามสกุล"] ?? row["last name"];
  //       const title = row.title ?? row["คำนำหน้า"] ?? row["prefix"];

  //       const fullName = [firstName, lastName]
  //         .filter((v) => v && String(v).trim() !== "")
  //         .join(" ")
  //         .trim();

  //       if (!fullName) {
  //         skipped++;
  //         continue;
  //       }

  //       let userCode = String(generatedRunning);
  //       generatedRunning++;

  //       const nationalId = row.national_id ?? row["national_id"] ?? row["citizen_id"] ?? row["เลขบัตรประชาชน"] ?? row["เลขประจำตัวประชาชน"] ?? row["id_card"] ?? null;
  //       const birthDateRaw = row.dateofbirth ?? row.birth_date ?? row["birth date"] ?? row["วันเกิด"] ?? row["วัน/เดือน/ปีเกิด"] ?? null;
  //       const birthDate = normalizeDate(birthDateRaw);

  //       processedData.push({
  //         userCode,
  //         fullName,
  //         firstName,
  //         lastName,
  //         title,
  //         nationalId,
  //         birthDate,
  //       });
  //     }

  //     // ------------------------------------------------------------------
  //     // Phase 2: ยิง Database (เปลี่ยนจาก Promise.all เป็น for...of เพื่อความปลอดภัยใน Transaction)
  //     // ------------------------------------------------------------------
  //     const CHUNK_SIZE = 50; 
  //     const rowChunks = chunk(processedData, CHUNK_SIZE);

  //     for (const batch of rowChunks) {
  //       // ใช้ for...of แทนเพื่อรันแบบ Sequential บน Single Connection
  //       for (const data of batch) {

  //         // 1. จัดการ User
  //         const { user, created: userCreated } = await userImportRepo.findOrCreateUser({
  //           user_code: data.userCode,
  //           full_name: data.fullName,
  //           first_name: data.firstName,
  //           last_name: data.lastName,
  //           title: data.title,
  //           national_id: data.nationalId,
  //           birth_date: data.birthDate,
  //         }, connection);

  //         if (userCreated) stats.totalUsersCreated++;
  //         else stats.totalUsersFound++;

  //         // 2. จัดการ Campaign Link
  //         const { userCampaign, created: campaignLinkCreated } = await userImportRepo.findOrCreateUserCampaign({
  //           user_id: user.id,
  //           campaign_id: campaignId,
  //         }, connection);

  //         if (campaignLinkCreated) stats.totalCampaignLinks++;

  //         // 3. จัดการ Session Links
  //         if (sessions.length > 0) {
  //           for (const session of sessions) {
  //             const { created: sessionLinkCreated } = await userImportRepo.findOrCreateUserSession({
  //               user_campaign_id: userCampaign.id,
  //               session_id: session.id,
  //               campaign_id: campaignId,
  //             }, connection);

  //             if (sessionLinkCreated) stats.totalSessionLinks++;
  //           }
  //         }
  //       }
  //     }

  //     if (skipped > 0) {
  //       console.warn(`Skipped ${skipped} rows (missing full_name)`);
  //     }

  //     await connection.commit();

  //     // 🚨 หมายเหตุ: ตรงนี้คือจุดที่คุณเขียนทับค่า stats. ตรวจสอบอีกครั้งว่าตั้งใจให้เป็นแบบนี้ไหม
  //     stats.totalUsersFound = previsNumber;
  //     stats.totalUsersCreated = previsNumber + stats.totalCampaignLinks;

  //     return stats;
  //   } catch (error) {
  //     await connection.rollback();
  //     console.error("Import failed, transaction rolled back:", error);
  //     throw error;
  //   } finally {
  //     // แนะนำให้มีการ release() หรือ destroy() connection ตรงนี้ด้วย ขึ้นอยู่กับ Library ที่ใช้
  //     // เช่น connection.release();
  //   }
  // };
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
       // console.warn(`Campaign ID ${campaignId} has no sessions to link.`);
        throw new Error(`รอบสอบนี้ยังไม่สร้างวันที่สอบกรุณาสร้างให้เรียบร้อยก่อนนำเข้าผู้สอบ`); // <-- เพิ่ม Error เพื่อบังคับให้มี Session ก่อน (ถ้าไม่มี Session เลย)
      }
      // if (sessions.length < 3) {
      //   console.warn(`Campaign ID ${campaignId} has no sessions to link.`);
      //   throw new Error(`รอบสอบนี้ยังไม่สร้างวันที่สอบครบ 3 วัน กรุณาสร้างให้เรียบร้อยก่อนนำเข้าผู้สอบ`); // <-- เพิ่ม Error เพื่อบังคับให้มี Session ก่อน (ถ้าไม่มี Session เลย)
      // }
      console.log("Sessions to link:", sessions.length);

    //  throw new Error("ทดสอบ Rollback"); // <-- ลองโยน Error เพื่อดูว่า Rollback ทำงานไหม (ลบออกเมื่อทดสอบเสร็จ)

      const previsNumber = await userImportRepo.findPreviousNumber(campaignId, connection);
      const currentMax = await userImportRepo.findMaxUserCodeByCampaign(campaignId, connection);

      let generatedRunning = currentMax + 1;
      let skipped = 0;
      //  const shuffledRows = shuffle(rows);

      // ------------------------------------------------------------------
      // Phase 1: เตรียมข้อมูลทั้งหมดไว้ใน Memory
      // ------------------------------------------------------------------
      const processedData = [];
      const seenNationalIdsInFile = new Set<string>();

      for (const row of rows) { //      for (const row of shuffledRows) {
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

        let userCode = String(generatedRunning);
        generatedRunning++;

        const nationalId = row.national_id ?? row["national_id"] ?? row["citizen_id"] ?? row["เลขบัตรประชาชน"] ?? row["เลขประจำตัวประชาชน"] ?? row["id_card"] ?? null;
        if (nationalId) {
          const cleanNationalId = String(nationalId).trim();
          if (seenNationalIdsInFile.has(cleanNationalId)) {
            throw new Error(`พบข้อมูลซ้ำซ้อนในไฟล์ที่อัปโหลด: เลขบัตรประชาชน ${cleanNationalId} (ชื่อ: ${fullName}) มีมากกว่า 1 รายการ กรุณาตรวจสอบไฟล์ของท่าน`);
          }
          seenNationalIdsInFile.add(cleanNationalId);
        }
        const birthDateRaw = row.dateofbirth ?? row.birth_date ?? row["birth date"] ?? row["วันเกิด"] ?? row["วัน/เดือน/ปีเกิด"] ?? null;
        const birthDate = normalizeDate(birthDateRaw);

        processedData.push({
          userCode,
          fullName,
          firstName,
          lastName,
          title,
          nationalId,
          birthDate,
        });
      }
      const nationalIdsToCheck = Array.from(seenNationalIdsInFile);
      
      if (nationalIdsToCheck.length > 0) {
        // หั่นทีละ 1000 เผื่อไฟล์ใหญ่มาก จะได้ไม่เกิน Limit ของ SQL 'IN' clause
        const checkChunks = chunk(nationalIdsToCheck, 1000); 
        
        for (const nIdChunk of checkChunks) {
          const placeholders = nIdChunk.map(() => "?").join(",");
          const sqlCheck = `
            SELECT u.national_id, u.full_name
            FROM users u
            JOIN user_campaigns uc ON u.id = uc.user_id
            WHERE uc.campaign_id = ? 
              AND u.national_id IN (${placeholders})
          `;
          
          const [existingUsers] = await connection.query<RowDataPacket[]>(sqlCheck, [campaignId, ...nIdChunk]);
          
          if (existingUsers && existingUsers.length > 0) {
            // ถ้าเจอว่ามีในระบบแล้ว ดึงรายชื่อมาโชว์ใน Error
            const duplicateNames = existingUsers.slice(0, 3).map(u => `${u.full_name} (${u.national_id})`).join(", ");
            const moreCount = existingUsers.length > 3 ? ` และอื่นๆ อีก ${existingUsers.length - 3} รายการ` : "";
            
            throw new Error(`ไม่สามารถนำเข้าได้ เนื่องจากพบผู้เข้าสอบที่ถูกนำเข้าในรอบสอบนี้ไปแล้ว: ${duplicateNames}${moreCount}`);
          }
        }
      }

      // ------------------------------------------------------------------
      // Phase 2: ยิง Database (เปลี่ยนจาก Promise.all เป็น for...of เพื่อความปลอดภัยใน Transaction)
      // ------------------------------------------------------------------
      // ------------------------------------------------------------------
      // Phase 2: ยิง Database (SUPER FAST BULK INSERT)
      // ------------------------------------------------------------------
      const CHUNK_SIZE = 500; // สามารถอัดเป็น 500-1000 ได้เลย
      const rowChunks = chunk(processedData, CHUNK_SIZE);

      for (const batch of rowChunks) {

        // 1. Bulk Upsert Users
        const dbUsers = await userImportRepo.bulkUpsertUsers(batch, connection);
        // *หมายเหตุ: การนับ Created/Found เป๊ะๆ ในระดับ Bulk จะค่อนข้างซับซ้อน 
        // ปกติเราจะนับรวมยอด Processed เป็นหลัก หรือใช้ยอดจาก dbUsers
        stats.totalUsersCreated += dbUsers.length;

        if (dbUsers.length === 0) continue;

        // 2. เตรียมข้อมูล & Bulk Insert Campaign Links
        const campaignPayload = dbUsers.map(u => ({
          userId: u.id,
          campaignId: campaignId
        }));

        const dbCampaigns = await userImportRepo.bulkInsertUserCampaigns(campaignPayload, connection);
        stats.totalCampaignLinks += dbCampaigns.length;

        // 3. เตรียมข้อมูล & Bulk Insert Session Links
        if (sessions.length > 0 && dbCampaigns.length > 0) {
          const sessionPayload: { userCampaignId: number; sessionId: number; campaignId: number }[] = [];

          for (const uc of dbCampaigns) {
            for (const session of sessions) {
              sessionPayload.push({
                userCampaignId: uc.id,
                sessionId: session.id,
                campaignId: campaignId
              });
            }
          }

          const insertedSessionsCount = await userImportRepo.bulkInsertUserSessions(sessionPayload, connection);
          stats.totalSessionLinks += insertedSessionsCount;
        }
      }
      if (skipped > 0) {
        console.warn(`Skipped ${skipped} rows (missing full_name)`);
      }

      await connection.commit();

      // 🚨 หมายเหตุ: ตรงนี้คือจุดที่คุณเขียนทับค่า stats. ตรวจสอบอีกครั้งว่าตั้งใจให้เป็นแบบนี้ไหม
      stats.totalUsersFound = previsNumber;
      stats.totalUsersCreated = previsNumber + stats.totalCampaignLinks;

      return stats;
    } catch (error) {
      await connection.rollback();
      console.error("Import failed, transaction rolled back:", error);
      throw error;
    } finally {
      // แนะนำให้มีการ release() หรือ destroy() connection ตรงนี้ด้วย ขึ้นอยู่กับ Library ที่ใช้
      // เช่น connection.release();
    }
  };



}