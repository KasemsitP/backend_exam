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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardService = void 0;
const dashboard_repo_1 = __importDefault(require("../Repo/dashboard.repo"));
const gradingscore_repo_1 = __importDefault(require("../Repo/gradingscore.repo"));
class DashboardService {
    static getCampaignDashboard(campaignId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g;
            const [rawBasicCounts, rawBagCounts, rawGradersCount, rawKeyCounts, rawImportStatus, rawEncryptedStatus, rawAvgScorePerQuestion, rawScoreDistribution, rawSubjectQuestions, // ✨ เพิ่มบรรทัดนี้
            rawStatus, rawDisputedQuestions, // ✨ เพิ่มบรรทัดนี้
            rawBookletsCount, rawBookletsBySession, rawSeatAssignmentStatus] = yield Promise.all([
                dashboard_repo_1.default.getCampaignBasicCounts(campaignId),
                dashboard_repo_1.default.getBagCountsPerSession(campaignId),
                dashboard_repo_1.default.getGradersCount(campaignId),
                dashboard_repo_1.default.getKeyCounts(campaignId),
                dashboard_repo_1.default.getStatusSession(campaignId),
                dashboard_repo_1.default.getIsEncrypted(campaignId),
                dashboard_repo_1.default.getAverageScorePerQuestion(campaignId),
                dashboard_repo_1.default.getScoreDistribution(campaignId),
                dashboard_repo_1.default.getSubjectQuestionsByCampaign(campaignId), // ✨
                dashboard_repo_1.default.getStatus(campaignId),
                gradingscore_repo_1.default.findDisputedQuestionsForDashboard(campaignId, 4),
                dashboard_repo_1.default.getCountBookets(campaignId),
                dashboard_repo_1.default.getCountBookletsBySession(campaignId),
                dashboard_repo_1.default.isAssigned(campaignId)
            ]);
            console.log("rawStatus:", rawStatus);
            const basicCounts = rawBasicCounts !== null && rawBasicCounts !== void 0 ? rawBasicCounts : {
                campaign_id: campaignId,
                session_count: 0,
                subject_count: 0,
            };
            const bagCounts = rawBagCounts !== null && rawBagCounts !== void 0 ? rawBagCounts : [];
            const gradersCount = rawGradersCount !== null && rawGradersCount !== void 0 ? rawGradersCount : {
                total_graders: 0,
                graders_with_login: 0,
            };
            const keyCounts = rawKeyCounts !== null && rawKeyCounts !== void 0 ? rawKeyCounts : {
                total_keys: 0,
                active_keys: 0,
            };
            const importStatus = rawImportStatus !== null && rawImportStatus !== void 0 ? rawImportStatus : [];
            const encryptedStatus = rawEncryptedStatus !== null && rawEncryptedStatus !== void 0 ? rawEncryptedStatus : [];
            const avgScorePerQuestion = rawAvgScorePerQuestion !== null && rawAvgScorePerQuestion !== void 0 ? rawAvgScorePerQuestion : [];
            const scoreDistribution = rawScoreDistribution !== null && rawScoreDistribution !== void 0 ? rawScoreDistribution : {
                total_users: 0,
                no_score: 0,
                buckets: [],
            };
            const sessions = {};
            // bags
            bagCounts.forEach((bag) => {
                var _a;
                sessions[bag.session_id] = {
                    sessionId: bag.session_id,
                    sessionCode: bag.session_code,
                    subject_name: bag.subject_name,
                    bags: {
                        total: bag.total_bags,
                        capacity: Number((_a = bag.total_capacity) !== null && _a !== void 0 ? _a : 0),
                    },
                };
            });
            // import status
            importStatus.forEach((imp) => {
                if (!sessions[imp.session_id])
                    return;
                sessions[imp.session_id].users = {
                    inCampaign: imp.users_in_campaign,
                    inSession: imp.users_in_session,
                };
                sessions[imp.session_id].importStatus = imp.import_status;
            });
            // encryption status
            encryptedStatus.forEach((enc) => {
                var _a, _b, _c;
                if (!sessions[enc.session_id])
                    return;
                sessions[enc.session_id].encryption = {
                    status: enc.encryption_status,
                    encrypted: Number((_a = enc.encrypted_users) !== null && _a !== void 0 ? _a : 0),
                    pending: Number((_b = enc.pending_users) !== null && _b !== void 0 ? _b : 0),
                    totalUsersInSession: (_c = enc.total_users_in_session) !== null && _c !== void 0 ? _c : 0,
                };
            });
            const subjectQuestionsBySubject = {};
            (rawSubjectQuestions !== null && rawSubjectQuestions !== void 0 ? rawSubjectQuestions : []).forEach((row) => {
                if (!subjectQuestionsBySubject[row.subject_id]) {
                    subjectQuestionsBySubject[row.subject_id] = {
                        subjectId: row.subject_id,
                        code: row.subject_code,
                        name: row.subject_name,
                        questions: [],
                    };
                }
                subjectQuestionsBySubject[row.subject_id].questions.push({
                    id: row.subject_question_id,
                    questionNo: row.question_no,
                    label: row.question_label,
                    maxScore: row.max_score,
                });
            });
            return {
                summary: {
                    campaignId: basicCounts.campaign_id,
                    sessionCount: basicCounts.session_count,
                    subjectCount: basicCounts.subject_count,
                    graders: {
                        total: (_a = gradersCount.total_graders) !== null && _a !== void 0 ? _a : 0,
                        withLogin: (_b = gradersCount.graders_with_login) !== null && _b !== void 0 ? _b : 0,
                    },
                    keys: {
                        total: (_c = keyCounts.total_keys) !== null && _c !== void 0 ? _c : 0,
                        active: Number((_d = keyCounts.active_keys) !== null && _d !== void 0 ? _d : 0),
                    },
                    scoreDistribution: {
                        totalUsers: (_e = scoreDistribution.total_users) !== null && _e !== void 0 ? _e : 0,
                        noScore: Number((_f = scoreDistribution.no_score) !== null && _f !== void 0 ? _f : 0),
                        // 👇 ตอนนี้เป็น array แล้ว
                        buckets: ((_g = scoreDistribution.buckets) !== null && _g !== void 0 ? _g : []).map((b) => {
                            var _a;
                            return ({
                                label: b.label,
                                count: Number((_a = b.count) !== null && _a !== void 0 ? _a : 0),
                            });
                        }),
                    },
                },
                sessions,
                avgScorePerQuestion,
                subjectQuestions: subjectQuestionsBySubject,
                rawStatus,
                rawDisputedQuestions,
                rawBookletsCount,
                rawBookletsBySession,
                seatAssignmentStatus: rawSeatAssignmentStatus
            };
        });
    }
}
exports.DashboardService = DashboardService;
