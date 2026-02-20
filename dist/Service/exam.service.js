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
exports.examDataService = void 0;
const exam_repo_1 = __importDefault(require("../Repo/exam.repo"));
const DB_1 = require("../model/DB");
class examDataService {
}
exports.examDataService = examDataService;
_a = examDataService;
examDataService.getInitialData = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const [campaigns, sessions, subjects] = yield Promise.all([
            exam_repo_1.default.fetchCampaignsNoActive(),
            exam_repo_1.default.fetchSessionsNoactive(),
            exam_repo_1.default.fetchSubjectsNoactive(),
        ]);
        return {
            campaigns,
            sessions,
            subjects,
        };
    }
    catch (error) {
        console.error("Service Error: Failed to get initial data", error);
        throw new Error("ไม่สามารถดึงข้อมูลตั้งต้นของระบบได้");
    }
});
examDataService.getCampaignNoactive = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const [campaigns, sessions, subjects] = yield Promise.all([
            exam_repo_1.default.fetchCampaignsNoActive(),
            exam_repo_1.default.fetchSessionsNoactive(),
            exam_repo_1.default.fetchSubjectsNoactive(),
        ]);
        return {
            campaigns,
            sessions,
            subjects,
        };
    }
    catch (error) {
        console.error("Service Error: Failed to get Campaigm Exam data", error);
        throw new Error("ไม่สามารถดึงข้อมูลตั้งต้นของระบบได้");
    }
});
examDataService.ActiveInActiveCampaign = (campaign_id) => __awaiter(void 0, void 0, void 0, function* () {
    const conn = yield DB_1.DB.getInstance().getConnection();
    try {
        yield conn.beginTransaction();
        const examLists = yield exam_repo_1.default.CampaignLists(conn);
        const is_active = yield exam_repo_1.default.Checkactive(conn, campaign_id);
        // หา current active (ถ้ามี)
        const current_active = examLists.find((row) => row.is_active === 1);
        if (is_active === 0) {
            if (current_active && current_active.id !== campaign_id) {
                throw new Error("มีรอบสอบที่เปิดใช้งานอยู่แล้ว กรุณาปิดรอบสอบเดิมก่อน");
            }
            yield exam_repo_1.default.UpdateExamActive(conn, campaign_id);
        }
        else {
            yield exam_repo_1.default.UpdateExamNoActive(conn, campaign_id);
        }
        yield conn.commit();
    }
    catch (error) {
        yield conn.rollback();
        console.error("Active/InActive Campaign Error:", error);
        throw error;
    }
    finally {
        conn.release();
    }
});
