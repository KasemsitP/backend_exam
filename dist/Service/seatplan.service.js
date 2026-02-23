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
exports.SeatPlanService = void 0;
const worker_threads_1 = require("worker_threads");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
class SeatPlanService {
    // ฟังก์ชันกลางสำหรับเรียก Worker
    static runWorkerTask(task, options) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                const isTsNode = __filename.endsWith('.ts');
                const workerPath = path_1.default.resolve(__dirname, `./seatplan.worker${isTsNode ? '.ts' : '.js'}`);
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
                // รอรับผลลัพธ์
                worker.on("message", (result) => __awaiter(this, void 0, void 0, function* () {
                    if (result.status === 'success') {
                        // กรณีที่ข้อมูลว่างเปล่า (เช่น info === null)
                        if (!result.filePath)
                            return resolve(null);
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
    // -------------------------------------------------
    // เรียกใช้ฟังก์ชันเดิมของคุณ โดยชี้ไปหา Worker แทน
    // -------------------------------------------------
    static generateSeatPlanPdf(options) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.runWorkerTask('generateSeatPlanPdf', options);
        });
    }
    static generateSeatPlanNameListPdf(options) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.runWorkerTask('generateSeatPlanNameListPdf', options);
        });
    }
}
exports.SeatPlanService = SeatPlanService;
