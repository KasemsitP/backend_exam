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
exports.GradingReportService = void 0;
const worker_threads_1 = require("worker_threads");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const DB_1 = require("../model/DB");
const grading_report_repo_1 = require("../Repo/grading-report.repo");
class GradingReportService {
    // -------------------------------------------------
    // ฟังก์ชันกลางสำหรับเรียก Worker
    // -------------------------------------------------
    static runWorkerTask(task, options) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                const isTsNode = __filename.endsWith('.ts');
                const workerPath = path_1.default.resolve(__dirname, `./grading-report.worker${isTsNode ? '.ts' : '.js'}`);
                let worker;
                if (isTsNode) {
                    worker = new worker_threads_1.Worker(`
                require('ts-node/register');
                require(require('worker_threads').workerData.__workerPath);
            `, {
                        eval: true,
                        workerData: { __workerPath: workerPath, task, options }
                    });
                }
                else {
                    worker = new worker_threads_1.Worker(workerPath, { workerData: { task, options } });
                }
                worker.on("message", (result) => __awaiter(this, void 0, void 0, function* () {
                    if (result.status === 'success') {
                        try {
                            const pdfBuffer = yield fs_1.default.promises.readFile(result.filePath);
                            yield fs_1.default.promises.unlink(result.filePath).catch(() => { });
                            resolve(pdfBuffer);
                        }
                        catch (err) {
                            reject(err);
                        }
                    }
                    else {
                        reject(new Error(result.message));
                    }
                }));
                worker.on("error", reject);
                worker.on("exit", (code) => {
                    if (code !== 0)
                        reject(new Error(`Worker stopped with exit code ${code}`));
                });
            });
        });
    }
    // =================================================
    // JSON Data API Methods (ให้ทำงานใน Main Thread)
    // =================================================
    static getScoresForBagSubject(bagId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const conn = yield DB_1.DB.getInstance().getConnection();
            const subjectId = 0;
            try {
                const questionCount = (_a = (yield (0, grading_report_repo_1.findQuestionCountForBagSubject)(conn, bagId, subjectId))) !== null && _a !== void 0 ? _a : 0;
                const rawRows = yield (0, grading_report_repo_1.findQuestionAveragesForBagSubject)(conn, bagId, subjectId);
                const byBooklet = new Map();
                for (const row of rawRows) {
                    const bookletId = row.booklet_id;
                    const questionNo = Number(row.question_no);
                    const avgScore = Number((_b = row.avg_score) !== null && _b !== void 0 ? _b : 0);
                    if (!byBooklet.has(bookletId)) {
                        const perQuestion = {};
                        for (let q = 1; q <= questionCount; q++)
                            perQuestion[q] = null;
                        byBooklet.set(bookletId, { bookletId, examCode: row.exam_code, perQuestion, totalScore: 0 });
                    }
                    byBooklet.get(bookletId).perQuestion[questionNo] = avgScore;
                }
                const rows = Array.from(byBooklet.values()).map((r) => {
                    let sum = 0;
                    for (let q = 1; q <= questionCount; q++) {
                        const sc = r.perQuestion[q];
                        if (sc != null)
                            sum += Number(sc);
                    }
                    return Object.assign(Object.assign({}, r), { totalScore: sum });
                });
                return { bagId, subjectId, questionCount, rows };
            }
            finally {
                conn.release();
            }
        });
    }
    static getBagScoresReport(bagId_1) {
        return __awaiter(this, arguments, void 0, function* (bagId, subjectId = 0) {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            const conn = yield DB_1.DB.getInstance().getConnection();
            try {
                const questionCount = (_a = (yield (0, grading_report_repo_1.findQuestionCountForBagSubject)(conn, bagId, subjectId))) !== null && _a !== void 0 ? _a : 0;
                const questionLabels = yield (0, grading_report_repo_1.findQuestionLabelForBagSubject)(conn, bagId, subjectId);
                const rawPerBooklet = yield (0, grading_report_repo_1.findBookletQuestionStatsForBag)(conn, bagId, subjectId);
                const result_is_unlock = yield (0, grading_report_repo_1.getUnlockCampaignByBagId)(conn, bagId);
                const unlock = (_c = (_b = result_is_unlock[0]) === null || _b === void 0 ? void 0 : _b.is_unlock) !== null && _c !== void 0 ? _c : 0;
                // Inline Helper (เหมือนใน worker)
                const byBooklet = new Map();
                for (const r of rawPerBooklet) {
                    let block = byBooklet.get(r.booklet_id);
                    if (!block) {
                        block = { bookletId: r.booklet_id, examCode: unlock === 1 ? r.exam_code : String(r.random_num), questionCount: 0, questions: [] };
                        byBooklet.set(r.booklet_id, block);
                    }
                    block.questions.push({
                        questionNo: r.question_no, label: (_d = r.label) !== null && _d !== void 0 ? _d : `ข้อ ${r.question_no}`,
                        category: (_e = r.category) !== null && _e !== void 0 ? _e : null, grader1Score: r.grader1_score != null ? Number(r.grader1_score) : null,
                        grader1Name: (_f = r.grader1_names) !== null && _f !== void 0 ? _f : null, grader2Score: r.grader2_score != null ? Number(r.grader2_score) : null,
                        grader2Name: (_g = r.grader2_names) !== null && _g !== void 0 ? _g : null, finalScore: r.final_score != null ? Number(r.final_score) : null,
                    });
                }
                for (const block of byBooklet.values()) {
                    const map = new Map();
                    for (const q of block.questions)
                        map.set(q.questionNo, q);
                    const maxQ = questionCount && questionCount > 0 ? questionCount : Array.from(map.keys()).reduce((m, q) => Math.max(m, q), 0);
                    const filled = [];
                    for (let q = 1; q <= maxQ; q++) {
                        filled.push((_h = map.get(q)) !== null && _h !== void 0 ? _h : { questionNo: q, label: `ข้อ ${q}`, category: null, grader1Score: null, grader1Name: null, grader2Score: null, grader2Name: null, finalScore: null });
                    }
                    block.questionCount = maxQ;
                    block.questions = filled;
                }
                const booklets = Array.from(byBooklet.values()).sort((a, b) => a.bookletId - b.bookletId);
                return { bagId, subjectId, questionCount, booklets, questionLabels: questionLabels !== null && questionLabels !== void 0 ? questionLabels : [] };
            }
            finally {
                conn.release();
            }
        });
    }
    // =================================================
    // PDF Generator Wrappers (ไปรันใน Worker)
    // =================================================
    static generateBagScorePdf(bagId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.runWorkerTask('generateBagScorePdf', { bagId });
        });
    }
    static generateCampaignBagScoresPdf(campaignId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.runWorkerTask('generateCampaignBagScoresPdf', { campaignId });
        });
    }
    static generateGraderBagSummaryPdf(bagId, graderId, graderName) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.runWorkerTask('generateGraderBagSummaryPdf', { bagId, graderId, graderName });
        });
    }
    static generatePassListPdf(opts) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.runWorkerTask('generatePassListPdf', opts);
        });
    }
    static generateRankingPdf(opts) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.runWorkerTask('generateRankingPdf', opts);
        });
    }
}
exports.GradingReportService = GradingReportService;
