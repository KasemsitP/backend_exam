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
// services/dashboard.service.ts
const dashboard_repo_1 = __importDefault(require("../Repo/dashboard.repo"));
const gradingscore_repo_1 = __importDefault(require("../Repo/gradingscore.repo"));
const cache = new Map();
function cached(key, ttlMs, fn) {
    return __awaiter(this, void 0, void 0, function* () {
        const now = Date.now();
        const hit = cache.get(key);
        if (hit && hit.exp > now)
            return hit.data;
        const data = yield fn();
        cache.set(key, { exp: now + ttlMs, data });
        return data;
    });
}
class DashboardService {
    /**
     * FAST: summary only (ควรเร็ว)
     * - basic counts
     * - bag counts per session
     * - graders count
     * - key counts
     * - import status per session
     * - encrypted status per session
     * - booklets counts
     * - seat assignment status (rooms)
     * - subject questions (ถ้าหนักมากสามารถแยกไปอีก endpoint ได้)
     */
    static getCampaignDashboardSummary(campaignId) {
        return __awaiter(this, void 0, void 0, function* () {
            return cached(`dash:summary:${campaignId}`, 30000, () => __awaiter(this, void 0, void 0, function* () {
                var _a, _b, _c, _d, _e, _f;
                const [rawBasicCounts, rawBagCounts, rawGradersCount, rawKeyCounts, rawImportStatus, rawEncryptedStatus, rawSubjectQuestions, rawBookletsCount, rawBookletsBySession, rawSeatAssignmentStatus,] = yield Promise.all([
                    dashboard_repo_1.default.getCampaignBasicCounts(campaignId),
                    dashboard_repo_1.default.getBagCountsPerSession(campaignId),
                    dashboard_repo_1.default.getGradersCount(campaignId),
                    dashboard_repo_1.default.getKeyCounts(campaignId),
                    dashboard_repo_1.default.getStatusSession(campaignId),
                    dashboard_repo_1.default.getIsEncrypted(campaignId),
                    dashboard_repo_1.default.getSubjectQuestionsByCampaign(campaignId),
                    dashboard_repo_1.default.getCountBookets(campaignId),
                    dashboard_repo_1.default.getCountBookletsBySession(campaignId),
                    dashboard_repo_1.default.isAssigned(campaignId),
                ]);
                const basicCounts = rawBasicCounts !== null && rawBasicCounts !== void 0 ? rawBasicCounts : {
                    campaign_id: campaignId,
                    session_count: 0,
                    subject_count: 0,
                };
                const bagCounts = rawBagCounts !== null && rawBagCounts !== void 0 ? rawBagCounts : [];
                const gradersCount = rawGradersCount !== null && rawGradersCount !== void 0 ? rawGradersCount : { total_graders: 0, graders_with_login: 0 };
                const keyCounts = rawKeyCounts !== null && rawKeyCounts !== void 0 ? rawKeyCounts : { total_keys: 0, active_keys: 0 };
                const importStatus = rawImportStatus !== null && rawImportStatus !== void 0 ? rawImportStatus : [];
                const encryptedStatus = rawEncryptedStatus !== null && rawEncryptedStatus !== void 0 ? rawEncryptedStatus : [];
                const sessions = {};
                // bags
                bagCounts.forEach((bag) => {
                    var _a, _b;
                    sessions[bag.session_id] = {
                        sessionId: bag.session_id,
                        sessionCode: bag.session_code,
                        subject_name: bag.subject_name,
                        bags: {
                            total: Number((_a = bag.total_bags) !== null && _a !== void 0 ? _a : 0),
                            capacity: Number((_b = bag.total_capacity) !== null && _b !== void 0 ? _b : 0),
                        },
                    };
                });
                // import status
                importStatus.forEach((imp) => {
                    var _a, _b;
                    if (!sessions[imp.session_id])
                        return;
                    sessions[imp.session_id].users = {
                        inCampaign: Number((_a = imp.users_in_campaign) !== null && _a !== void 0 ? _a : 0),
                        inSession: Number((_b = imp.users_in_session) !== null && _b !== void 0 ? _b : 0),
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
                        totalUsersInSession: Number((_c = enc.total_users_in_session) !== null && _c !== void 0 ? _c : 0),
                    };
                });
                // subject questions → grouped by subject
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
                    // sq อาจ null ถ้ายังไม่มี questions
                    if (row.subject_question_id != null) {
                        subjectQuestionsBySubject[row.subject_id].questions.push({
                            id: row.subject_question_id,
                            questionNo: row.question_no,
                            label: row.question_label,
                            maxScore: row.max_score,
                        });
                    }
                });
                return {
                    summary: {
                        campaignId: basicCounts.campaign_id,
                        sessionCount: Number((_a = basicCounts.session_count) !== null && _a !== void 0 ? _a : 0),
                        subjectCount: Number((_b = basicCounts.subject_count) !== null && _b !== void 0 ? _b : 0),
                        graders: {
                            total: Number((_c = gradersCount.total_graders) !== null && _c !== void 0 ? _c : 0),
                            withLogin: Number((_d = gradersCount.graders_with_login) !== null && _d !== void 0 ? _d : 0),
                        },
                        keys: {
                            total: Number((_e = keyCounts.total_keys) !== null && _e !== void 0 ? _e : 0),
                            active: Number((_f = keyCounts.active_keys) !== null && _f !== void 0 ? _f : 0),
                        },
                    },
                    sessions,
                    subjectQuestions: subjectQuestionsBySubject,
                    rawBookletsCount: Number(rawBookletsCount !== null && rawBookletsCount !== void 0 ? rawBookletsCount : 0),
                    rawBookletsBySession: rawBookletsBySession !== null && rawBookletsBySession !== void 0 ? rawBookletsBySession : [],
                    seatAssignmentStatus: rawSeatAssignmentStatus !== null && rawSeatAssignmentStatus !== void 0 ? rawSeatAssignmentStatus : [],
                };
            }));
        });
    }
    /**
     * SLOWER: charts / analytics (โหลดทีหลัง)
     * - score distribution (bucketed in SQL)
     * - avg score per question (simple)
     * - disputed questions
     * - average question score (grader1/2/final) แบบ optimized
     *
     * NOTE: rawStatus/slotCoverage หนักมาก → แยก endpoint ต่างหากถ้าจะใช้
     */
    static getCampaignDashboardCharts(campaignId) {
        return __awaiter(this, void 0, void 0, function* () {
            return cached(`dash:charts:${campaignId}`, 30000, () => __awaiter(this, void 0, void 0, function* () {
                const [rawAvgScorePerQuestion, rawScoreDistribution, rawDisputedQuestions, rawAverageQuestionScore,] = yield Promise.all([
                    dashboard_repo_1.default.getAverageScorePerQuestion(campaignId),
                    dashboard_repo_1.default.getScoreDistributionBucketed(campaignId),
                    gradingscore_repo_1.default.findDisputedQuestionsForDashboard(campaignId, 4),
                    dashboard_repo_1.default.getAverageQuestionScoreOptimized(campaignId),
                ]);
                // group averageQuestionScore by session_id for FE
                const grouped = (rawAverageQuestionScore !== null && rawAverageQuestionScore !== void 0 ? rawAverageQuestionScore : []).reduce((acc, item) => {
                    var _a, _b, _c, _d, _e;
                    if (!acc[item.session_id])
                        acc[item.session_id] = [];
                    acc[item.session_id].push({
                        subject_id: item.subject_id,
                        question_no: item.question_no,
                        label: item.label,
                        category: item.category,
                        grader1_avg: Number((_a = item.grader1_avg) !== null && _a !== void 0 ? _a : 0),
                        grader2_avg: Number((_b = item.grader2_avg) !== null && _b !== void 0 ? _b : 0),
                        final_avg: Number((_c = item.final_avg) !== null && _c !== void 0 ? _c : 0),
                        n1: Number((_d = item.n1) !== null && _d !== void 0 ? _d : 0),
                        n2: Number((_e = item.n2) !== null && _e !== void 0 ? _e : 0),
                    });
                    return acc;
                }, {});
                console.log(rawScoreDistribution);
                return {
                    avgScorePerQuestion: rawAvgScorePerQuestion !== null && rawAvgScorePerQuestion !== void 0 ? rawAvgScorePerQuestion : [],
                    scoreDistribution: rawScoreDistribution, //
                    rawDisputedQuestions: rawDisputedQuestions !== null && rawDisputedQuestions !== void 0 ? rawDisputedQuestions : [],
                    rawAverageQuestionScore: grouped,
                };
            }));
        });
    }
    /**
     * OPTIONAL: heavy debug endpoint (ควร cache นาน + เรียกเฉพาะตอนกดดู)
     */
    static getCampaignDashboardSlotCoverage(campaignId) {
        return __awaiter(this, void 0, void 0, function* () {
            return cached(`dash:slotCoverage:${campaignId}`, 5 * 60000, () => __awaiter(this, void 0, void 0, function* () {
                const rawStatus = yield dashboard_repo_1.default.getStatus(campaignId);
                return { rawStatus };
            }));
        });
    }
}
exports.DashboardService = DashboardService;
