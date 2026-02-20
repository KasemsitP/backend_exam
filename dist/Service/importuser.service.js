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
const session_repo_1 = __importDefault(require("../Repo/session.repo")); // (Repo ที่มีอยู่)
const lodash_shuffle_1 = __importDefault(require("lodash.shuffle"));
function normalizeDate(input) {
    if (!input)
        return null;
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
class userImportService {
}
exports.userImportService = userImportService;
_a = userImportService;
userImportService.importUsersToCampaign = (campaignId, rows) => __awaiter(void 0, void 0, void 0, function* () {
    var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0;
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
        const currentMax = yield importuser_repo_1.default.findMaxUserCodeByCampaign(campaignId, connection);
        let generatedRunning = currentMax + 1;
        let skipped = 0;
        const shuffledRows = (0, lodash_shuffle_1.default)(rows);
        console.log("Shuffled Rows:", shuffledRows);
        for (const row of shuffledRows) {
            // 0) no (ลำดับในไฟล์) - เอาไว้อ้างอิง log เฉย ๆ ถ้าอยากใช้
            const rowNo = (_d = (_c = (_b = row.no) !== null && _b !== void 0 ? _b : row["no"]) !== null && _c !== void 0 ? _c : row["ลำดับ"]) !== null && _d !== void 0 ? _d : null;
            // 1) หา userCode (ถ้าไม่มีจากไฟล์ก็ gen)
            let userCode = undefined;
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
            const title = (_f = (_e = row.title) !== null && _e !== void 0 ? _e : row["คำนำหน้า"]) !== null && _f !== void 0 ? _f : row["prefix"];
            const firstName = (_k = (_j = (_h = (_g = row.firstname) !== null && _g !== void 0 ? _g : row.first_name) !== null && _h !== void 0 ? _h : row.firstName) !== null && _j !== void 0 ? _j : row["ชื่อ"]) !== null && _k !== void 0 ? _k : row["first name"];
            const lastName = (_p = (_o = (_m = (_l = row.lastname) !== null && _l !== void 0 ? _l : row.last_name) !== null && _m !== void 0 ? _m : row.lastName) !== null && _o !== void 0 ? _o : row["นามสกุล"]) !== null && _p !== void 0 ? _p : row["last name"];
            const fullName = [firstName, lastName]
                .filter((v) => v && String(v).trim() !== "")
                .join(" ")
                .trim();
            if (!fullName) {
                skipped++;
                continue;
            }
            // 3) national_id
            const nationalId = (_v = (_u = (_t = (_s = (_r = (_q = row.national_id) !== null && _q !== void 0 ? _q : row["national_id"]) !== null && _r !== void 0 ? _r : row["citizen_id"]) !== null && _s !== void 0 ? _s : row["เลขบัตรประชาชน"]) !== null && _t !== void 0 ? _t : row["เลขประจำตัวประชาชน"]) !== null && _u !== void 0 ? _u : row["id_card"]) !== null && _v !== void 0 ? _v : null;
            // 4) birth_date (พยายาม normalize เป็น YYYY-MM-DD ถ้า parse ได้)
            const birthDateRaw = (_0 = (_z = (_y = (_x = (_w = row.dateofbirth) !== null && _w !== void 0 ? _w : row.birth_date) !== null && _x !== void 0 ? _x : row["birth date"]) !== null && _y !== void 0 ? _y : row["วันเกิด"]) !== null && _z !== void 0 ? _z : row["วัน/เดือน/ปีเกิด"]) !== null && _0 !== void 0 ? _0 : null;
            const birthDate = normalizeDate(birthDateRaw);
            const { user, created: userCreated } = yield importuser_repo_1.default.findOrCreateUser({
                user_code: userCode,
                full_name: fullName,
                first_name: firstName,
                last_name: lastName,
                title: title,
                national_id: nationalId,
                birth_date: birthDate,
            }, connection);
            if (userCreated)
                stats.totalUsersCreated++;
            else
                stats.totalUsersFound++;
            const { userCampaign, created: campaignLinkCreated } = yield importuser_repo_1.default.findOrCreateUserCampaign({ user_id: user.id, campaign_id: campaignId }, connection);
            if (campaignLinkCreated)
                stats.totalCampaignLinks++;
            for (const session of sessions) {
                const { created: sessionLinkCreated } = yield importuser_repo_1.default.findOrCreateUserSession({
                    user_campaign_id: userCampaign.id,
                    session_id: session.id,
                    campaign_id: campaignId,
                }, connection);
                if (sessionLinkCreated)
                    stats.totalSessionLinks++;
            }
        }
        if (skipped > 0) {
            console.warn(`Skipped ${skipped} rows (missing full_name)`);
        }
        yield connection.commit();
        return stats;
    }
    catch (error) {
        yield connection.rollback();
        console.error("Import Error (Service):", error);
        throw error;
    }
    finally {
        connection.release();
    }
});
