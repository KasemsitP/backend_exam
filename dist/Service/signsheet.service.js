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
exports.SignSheetService = void 0;
const worker_threads_1 = require("worker_threads");
const path_1 = __importDefault(require("path"));
const signsheet_repo_1 = __importDefault(require("../Repo/signsheet.repo"));
const fs_1 = __importDefault(require("fs")); // เพิ่มบรรทัดนี้
const chunk = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));
class SignSheetService {
    static generatePdfInWorker(options) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                // 1. เรียกผู้ช่วยเชฟมาทำงาน (ชี้ไปที่ไฟล์ Worker)
                const workerPath = path_1.default.resolve(__dirname, 'pdf-worker.js');
                const worker = new worker_threads_1.Worker(workerPath, { workerData: options });
                // 2. รอผู้ช่วยเชฟส่งงานกลับมา
                worker.on("message", (result) => {
                    resolve(result); // ได้ไฟล์ PDF มาแล้ว
                });
                // ดัก Error ถ้าผู้ช่วยทำพลาด
                worker.on("error", reject);
                worker.on("exit", (code) => {
                    if (code !== 0)
                        reject(new Error(`Worker stopped with exit code ${code}`));
                });
            });
        });
    }
    static generateSignSheetPdf(options) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                const isTsNode = __filename.endsWith('.ts');
                const workerPath = path_1.default.resolve(__dirname, `./pdf.worker${isTsNode ? '.ts' : '.js'}`);
                let worker;
                if (isTsNode) {
                    worker = new worker_threads_1.Worker(`
          const { workerData } = require('worker_threads');
          require('ts-node').register();
          require(workerData.__workerPath);
        `, {
                        eval: true,
                        workerData: Object.assign({ __workerPath: workerPath }, options)
                    });
                }
                else {
                    worker = new worker_threads_1.Worker(workerPath, { workerData: options });
                }
                // รับไฟล์กลับมาจาก Worker
                worker.on("message", (result) => __awaiter(this, void 0, void 0, function* () {
                    if (result.status === 'success') {
                        try {
                            const pdfBuffer = yield fs_1.default.promises.readFile(result.filePath);
                            yield fs_1.default.promises.unlink(result.filePath).catch(e => console.error("ลบ Temp ไม่สำเร็จ", e));
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
                worker.on("error", (error) => reject(error));
                worker.on("exit", (code) => {
                    if (code !== 0)
                        reject(new Error(`Worker stopped with exit code ${code}`));
                });
            });
        });
    }
    static getRowsForSession(session_id, campaign_id) {
        return __awaiter(this, void 0, void 0, function* () {
            const list = yield signsheet_repo_1.default.findUserSessionByCampaignAndSession(session_id, campaign_id);
            return list.map((r) => {
                var _a, _b;
                return ({
                    firstName: r.firstName,
                    lastName: r.lastName,
                    userCode: r.userCode,
                    roomName: (_a = r.roomName) !== null && _a !== void 0 ? _a : null,
                    qr_payload: (_b = r.qr_payload) !== null && _b !== void 0 ? _b : null,
                    row_no: r.row_no,
                    title: r.title,
                    col_no: r.col_no
                });
            });
        });
    }
    //  ใหม่: สำหรับหน้าเว็บ (pagination)
    static getPaginatedUserSessions(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { session_id, campaign_id, page, limit, search } = options;
            console.log("Fetching paginated user sessions with options:", options);
            return signsheet_repo_1.default.findUserSessionsWithPagination(session_id, campaign_id, page, limit, search);
        });
    }
}
exports.SignSheetService = SignSheetService;
