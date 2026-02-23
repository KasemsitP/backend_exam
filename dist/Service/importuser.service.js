"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.userImportService = void 0;
const DB_1 = require("../model/DB");
const importuser_repo_1 = __importDefault(require("../Repo/importuser.repo"));
const session_repo_1 = __importDefault(require("../Repo/session.repo"));
const lodash_1 = require("lodash");
function normalizeDate(input) {
    // ... (ฟังก์ชันเดิมของคุณ ดีอยู่แล้ว) ...
    if (!input)
        return null;
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
class userImportService {
}
exports.userImportService = userImportService;
_a = userImportService;
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
userImportService.importUsersToCampaign = (campaignId, rows) => __awaiter(void 0, void 0, void 0, function* () {
    var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x;
    const connection = yield DB_1.DB.getInstance().getConnection();
    let stats = {
        totalUsersCreated: 0,
        totalUsersFound: 0,
        totalCampaignLinks: 0,
        totalSessionLinks: 0,
    };
    try {
        yield connection.beginTransaction();
        const sessions = yield session_repo_1.default.findAllLiteByCampaignId(campaignId, connection);
        if (sessions.length === 0) {
            console.warn(`Campaign ID ${campaignId} has no sessions to link.`);
        }
        const previsNumber = yield importuser_repo_1.default.findPreviousNumber(campaignId, connection);
        const currentMax = yield importuser_repo_1.default.findMaxUserCodeByCampaign(campaignId, connection);
        let generatedRunning = currentMax + 1;
        let skipped = 0;
        //  const shuffledRows = shuffle(rows);
        // ------------------------------------------------------------------
        // Phase 1: เตรียมข้อมูลทั้งหมดไว้ใน Memory
        // ------------------------------------------------------------------
        const processedData = [];
        for (const row of rows) { //      for (const row of shuffledRows) {
            const firstName = (_e = (_d = (_c = (_b = row.firstname) !== null && _b !== void 0 ? _b : row.first_name) !== null && _c !== void 0 ? _c : row.firstName) !== null && _d !== void 0 ? _d : row["ชื่อ"]) !== null && _e !== void 0 ? _e : row["first name"];
            const lastName = (_j = (_h = (_g = (_f = row.lastname) !== null && _f !== void 0 ? _f : row.last_name) !== null && _g !== void 0 ? _g : row.lastName) !== null && _h !== void 0 ? _h : row["นามสกุล"]) !== null && _j !== void 0 ? _j : row["last name"];
            const title = (_l = (_k = row.title) !== null && _k !== void 0 ? _k : row["คำนำหน้า"]) !== null && _l !== void 0 ? _l : row["prefix"];
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
            const nationalId = (_s = (_r = (_q = (_p = (_o = (_m = row.national_id) !== null && _m !== void 0 ? _m : row["national_id"]) !== null && _o !== void 0 ? _o : row["citizen_id"]) !== null && _p !== void 0 ? _p : row["เลขบัตรประชาชน"]) !== null && _q !== void 0 ? _q : row["เลขประจำตัวประชาชน"]) !== null && _r !== void 0 ? _r : row["id_card"]) !== null && _s !== void 0 ? _s : null;
            const birthDateRaw = (_x = (_w = (_v = (_u = (_t = row.dateofbirth) !== null && _t !== void 0 ? _t : row.birth_date) !== null && _u !== void 0 ? _u : row["birth date"]) !== null && _v !== void 0 ? _v : row["วันเกิด"]) !== null && _w !== void 0 ? _w : row["วัน/เดือน/ปีเกิด"]) !== null && _x !== void 0 ? _x : null;
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
        // ------------------------------------------------------------------
        // Phase 2: ยิง Database (เปลี่ยนจาก Promise.all เป็น for...of เพื่อความปลอดภัยใน Transaction)
        // ------------------------------------------------------------------
        // ------------------------------------------------------------------
        // Phase 2: ยิง Database (SUPER FAST BULK INSERT)
        // ------------------------------------------------------------------
        const CHUNK_SIZE = 500; // สามารถอัดเป็น 500-1000 ได้เลย
        const rowChunks = (0, lodash_1.chunk)(processedData, CHUNK_SIZE);
        for (const batch of rowChunks) {
            // 1. Bulk Upsert Users
            const dbUsers = yield importuser_repo_1.default.bulkUpsertUsers(batch, connection);
            // *หมายเหตุ: การนับ Created/Found เป๊ะๆ ในระดับ Bulk จะค่อนข้างซับซ้อน 
            // ปกติเราจะนับรวมยอด Processed เป็นหลัก หรือใช้ยอดจาก dbUsers
            stats.totalUsersCreated += dbUsers.length;
            if (dbUsers.length === 0)
                continue;
            // 2. เตรียมข้อมูล & Bulk Insert Campaign Links
            const campaignPayload = dbUsers.map(u => ({
                userId: u.id,
                campaignId: campaignId
            }));
            const dbCampaigns = yield importuser_repo_1.default.bulkInsertUserCampaigns(campaignPayload, connection);
            stats.totalCampaignLinks += dbCampaigns.length;
            // 3. เตรียมข้อมูล & Bulk Insert Session Links
            if (sessions.length > 0 && dbCampaigns.length > 0) {
                const sessionPayload = [];
                for (const uc of dbCampaigns) {
                    for (const session of sessions) {
                        sessionPayload.push({
                            userCampaignId: uc.id,
                            sessionId: session.id,
                            campaignId: campaignId
                        });
                    }
                }
                const insertedSessionsCount = yield importuser_repo_1.default.bulkInsertUserSessions(sessionPayload, connection);
                stats.totalSessionLinks += insertedSessionsCount;
            }
        }
        if (skipped > 0) {
            console.warn(`Skipped ${skipped} rows (missing full_name)`);
        }
        yield connection.commit();
        // 🚨 หมายเหตุ: ตรงนี้คือจุดที่คุณเขียนทับค่า stats. ตรวจสอบอีกครั้งว่าตั้งใจให้เป็นแบบนี้ไหม
        stats.totalUsersFound = previsNumber;
        stats.totalUsersCreated = previsNumber + stats.totalCampaignLinks;
        return stats;
    }
    catch (error) {
        yield connection.rollback();
        console.error("Import failed, transaction rolled back:", error);
        throw error;
    }
    finally {
        // แนะนำให้มีการ release() หรือ destroy() connection ตรงนี้ด้วย ขึ้นอยู่กับ Library ที่ใช้
        // เช่น connection.release();
    }
});
