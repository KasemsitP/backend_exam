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
class examDataService {
}
exports.examDataService = examDataService;
_a = examDataService;
examDataService.getInitialData = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const [campaigns, sessions, subjects] = yield Promise.all([
            exam_repo_1.default.fetchActiveCampaigns(),
            exam_repo_1.default.fetchSessionsForActiveCampaigns(),
            exam_repo_1.default.fetchSubjectsForActiveCampaigns(),
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
