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
exports.GraderBagReportService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const worker_threads_1 = require("worker_threads");
const graderbag_report_repo_1 = __importDefault(require("../Repo/graderbag-report.repo"));
const grader_report_repo_1 = __importDefault(require("../Repo/grader-report.repo"));
const DB_1 = require("../model/DB");
const key_service_1 = require("./key.service");
class GraderBagReportService {
    static runWorkerTask(task, options) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                const isTsNode = __filename.endsWith(".ts");
                const workerPath = path_1.default.resolve(__dirname, `./graderbag.worker${isTsNode ? ".ts" : ".js"}`);
                let worker;
                if (isTsNode) {
                    worker = new worker_threads_1.Worker(`
            require('ts-node/register');
            require(require('worker_threads').workerData.__workerPath);
          `, {
                        eval: true,
                        workerData: { __workerPath: workerPath, task, options },
                    });
                }
                else {
                    worker = new worker_threads_1.Worker(workerPath, {
                        workerData: { task, options },
                    });
                }
                worker.on("message", (result) => __awaiter(this, void 0, void 0, function* () {
                    if (result.status === "success") {
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
                        reject(new Error(result.message || "Worker failed"));
                    }
                }));
                worker.on("error", reject);
                worker.on("exit", (code) => {
                    if (code !== 0) {
                        reject(new Error(`Worker stopped with exit code ${code}`));
                    }
                });
            });
        });
    }
    static generateBagScorePayloadPdf(bagId, questionNo, graderId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g;
            const conn = yield DB_1.DB.getInstance().getConnection();
            try {
                const header = yield graderbag_report_repo_1.default.findBagReportHeader(conn, bagId);
                if (!header) {
                    throw new Error("ไม่พบข้อมูลถุงที่ต้องการสร้างรายงาน");
                }
                const graderInfo = yield graderbag_report_repo_1.default.findGraderInfoByBagId(conn, graderId);
                //console.log("Grader Info:", graderInfo , { bagId, questionNo, graderId });
                if (!graderInfo) {
                    throw new Error("ไม่พบข้อมูลผู้ตรวจของถุงนี้");
                }
                const scoreRows = yield graderbag_report_repo_1.default.findConfirmedScoresByBagId(conn, bagId, questionNo, graderId);
                if (!scoreRows.length) {
                    throw new Error("ไม่พบคะแนนที่ยืนยันแล้วในถุงนี้");
                }
                const rows = scoreRows.map((row) => ({
                    random_num: row.random_num,
                    qr_payload: row.qr_payload
                        ? key_service_1.keyService.maskQrPayload(row.qr_payload)
                        : null,
                    score: row.score,
                }));
                const grader_order = scoreRows.map(row => row.grader_order);
                const allSameGraderOrder = grader_order.every(v => v === grader_order[0]);
                if (!allSameGraderOrder) {
                    throw new Error("พบคะแนนจาก grader หลายคนในถุงนี้ ซึ่งไม่ควรเกิดขึ้น");
                }
                const bagData = {
                    bag_no: header.bag_no,
                    info: {
                        org: (_a = header.campaign_name) !== null && _a !== void 0 ? _a : "-",
                        course: (_b = header.subject_name) !== null && _b !== void 0 ? _b : "-",
                        site: (_c = header.site) !== null && _c !== void 0 ? _c : "-",
                        start_num: (_d = header.start_num) !== null && _d !== void 0 ? _d : "-",
                        end_num: (_e = header.end_num) !== null && _e !== void 0 ? _e : "-",
                        grader_order: (_f = grader_order[0]) !== null && _f !== void 0 ? _f : null,
                        question_no: questionNo,
                        full_name: (_g = graderInfo.full_name) !== null && _g !== void 0 ? _g : "-"
                    },
                    rows,
                };
                const pdfBuffer = yield this.runWorkerTask("generateBagPayloadPdf", {
                    bag: bagData,
                });
                return pdfBuffer;
            }
            catch (error) {
                console.log("Service Error (GraderBagReportService.generateBagScorePayloadPdf):", error);
                throw error;
            }
            finally {
                conn.release();
            }
        });
    }
    static generateBagManualPayloadPdf(bagId, graderId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j;
            const conn = yield DB_1.DB.getInstance().getConnection();
            try {
                const header = yield graderbag_report_repo_1.default.findBagReportHeader(conn, bagId);
                if (!header) {
                    throw new Error("ไม่พบข้อมูลถุงที่ต้องการสร้างรายงาน");
                }
                const graderInfo = yield graderbag_report_repo_1.default.findGraderInfoByBagId(conn, graderId);
                if (!graderInfo) {
                    throw new Error("ไม่พบข้อมูลผู้ตรวจของถุงนี้");
                }
                const subjectQuestions = yield grader_report_repo_1.default.getDerivedSubjestQuestionfromBagID(conn, bagId);
                if (!subjectQuestions.length) {
                    throw new Error("ไม่พบรายการข้อของวิชาในถุงนี้");
                }
                const booklets = yield graderbag_report_repo_1.default.findBookletsByBagId(conn, bagId);
                if (!booklets.length) {
                    throw new Error("ไม่พบเล่มข้อสอบในถุงนี้");
                }
                const rows = booklets.map((b) => ({
                    random_num: b.random_num,
                    qr_payload: b.qr_payload ? key_service_1.keyService.maskQrPayload(b.qr_payload) : null,
                }));
                const questions = subjectQuestions.map((q) => {
                    var _a;
                    return ({
                        question_no: q.question_no,
                        label: (_a = q.label) !== null && _a !== void 0 ? _a : null,
                    });
                });
                const subjectName = (_c = (_b = (_a = subjectQuestions[0]) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : header.subject_name) !== null && _c !== void 0 ? _c : "-";
                const questionNo = (_d = subjectQuestions[0]) === null || _d === void 0 ? void 0 : _d.question_no;
                const graderOrder = questionNo
                    ? yield graderbag_report_repo_1.default.findGraderOrderInBag(conn, bagId, graderId, questionNo)
                    : null;
                const manualBag = {
                    bag_no: header.bag_no,
                    info: {
                        org: (_e = header.campaign_name) !== null && _e !== void 0 ? _e : "-",
                        course: subjectName,
                        site: (_f = header.site) !== null && _f !== void 0 ? _f : "-",
                        start_num: (_g = header.start_num) !== null && _g !== void 0 ? _g : "-",
                        end_num: (_h = header.end_num) !== null && _h !== void 0 ? _h : "-",
                        grader_order: graderOrder,
                        full_name: (_j = graderInfo.full_name) !== null && _j !== void 0 ? _j : "-",
                    },
                    rows,
                    questions,
                };
                const pdfBuffer = yield this.runWorkerTask("generateBagManualPayloadPdf", {
                    manualBag,
                });
                return pdfBuffer;
            }
            catch (error) {
                console.log("Service Error (GraderBagReportService.generateBagManualPayloadPdf):", error);
                throw error;
            }
            finally {
                conn.release();
            }
        });
    }
}
exports.GraderBagReportService = GraderBagReportService;
