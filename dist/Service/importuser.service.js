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
class userImportService {
}
exports.userImportService = userImportService;
_a = userImportService;
userImportService.importUsersToCampaign = (campaignId, rows) => __awaiter(void 0, void 0, void 0, function* () {
    var _b, _c, _d, _e, _f, _g, _h, _j;
    const connection = yield DB_1.DB.getInstance().getConnection();
    let stats = {
        totalUsersCreated: 0,
        totalUsersFound: 0,
        totalCampaignLinks: 0,
        totalSessionLinks: 0,
    };
    try {
        yield connection.beginTransaction();
        // [ ⭐️ 1. แก้ไข: ดึง Session (id และ site_id) ⭐️ ]
        // (เปลี่ยนจาก findAllIdsByCampaignId -> findAllLiteByCampaignId)
        const sessions = yield session_repo_1.default.findAllLiteByCampaignId(campaignId, connection);
        if (sessions.length === 0) {
            console.warn(`Campaign ID ${campaignId} has no sessions to link.`);
        }
        // 2. วน Loop ผู้ใช้ (Rows)
        for (const row of rows) {
            // (ส่วนนี้ถูกต้องแล้ว)
            const userCode = (_e = (_d = (_c = (_b = row.user_code) !== null && _b !== void 0 ? _b : row.nationalId) !== null && _c !== void 0 ? _c : row["รหัสประจำตัวประชาชน"]) !== null && _d !== void 0 ? _d : row["เลขบัตรประชาชน"]) !== null && _e !== void 0 ? _e : row.number;
            const fullName = (_g = (_f = row.full_name) !== null && _f !== void 0 ? _f : row.Player) !== null && _g !== void 0 ? _g : `${(_h = row.firstName) !== null && _h !== void 0 ? _h : row["ชื่อ"]} ${(_j = row.lastName) !== null && _j !== void 0 ? _j : row["นามสกุล"]}`;
            if (!userCode || !fullName || fullName.trim() === "") {
                console.warn("Skipping row, missing user_code or full_name:", row);
                continue;
            }
            // 3. Find/Create User (ตาราง 'users')
            const { user, created: userCreated } = yield importuser_repo_1.default.findOrCreateUser({ user_code: userCode, full_name: fullName.trim() }, connection);
            if (userCreated)
                stats.totalUsersCreated++;
            else
                stats.totalUsersFound++;
            // 4. Find/Create UserCampaign (เชื่อม 'users' ↔ 'exam_campaigns')
            const { userCampaign, created: campaignLinkCreated } = yield importuser_repo_1.default.findOrCreateUserCampaign({ user_id: user.id, campaign_id: campaignId }, connection);
            if (campaignLinkCreated)
                stats.totalCampaignLinks++;
            // [ ⭐️ 2. แก้ไข: วน Loop (Sessions) ⭐️ ]
            // (เปลี่ยนจาก sessionId -> session)
            for (const session of sessions) {
                // 6. Find/Create UserSession (เชื่อม 'user_campaigns' ↔ 'sessions')
                // [ ⭐️ 3. แก้ไข: เพิ่ม site_id ⭐️ ]
                // (ส่ง site_id ไปให้ Repo เพื่อแก้ Error)
                const { created: sessionLinkCreated } = yield importuser_repo_1.default.findOrCreateUserSession({
                    user_campaign_id: userCampaign.id,
                    session_id: session.id, // 👈 (ใช้ session.id)
                    campaign_id: campaignId,
                    site_id: session.site_id, // 👈 (เพิ่ม site_id)
                }, connection);
                if (sessionLinkCreated)
                    stats.totalSessionLinks++;
            }
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
