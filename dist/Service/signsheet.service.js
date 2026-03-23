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
const DB_1 = require("../model/DB");
const booklets_repo_1 = __importDefault(require("../Repo/booklets.repo"));
const key_service_1 = require("./key.service");
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
                var _a;
                return ({
                    firstName: r.firstName,
                    lastName: r.lastName,
                    userCode: r.userCode,
                    roomName: (_a = r.roomName) !== null && _a !== void 0 ? _a : null,
                    qr_payload: r.qr_payload ? key_service_1.keyService.maskQrPayload(r.qr_payload) : null,
                    row_no: r.row_no,
                    title: r.title,
                    col_no: r.col_no
                });
            });
        });
    }
    static getPaginatedUserSessions(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { session_id, campaign_id, page, limit, search } = options;
            // 1. ดึงข้อมูลรายชื่อจาก Repo
            const result = yield signsheet_repo_1.default.findUserSessionsWithPagination(session_id, campaign_id, page, limit, search);
            if (result.data.length === 0)
                return result;
            let connection;
            try {
                connection = yield DB_1.DB.getInstance().getConnection();
                // 🛑 2. เช็คว่าแคมเปญนี้ปลดล็อค (is_unlock = 1) หรือยัง?
                const [[campaign]] = yield connection.query(`SELECT is_unlock FROM exam_campaigns WHERE id = ?`, [campaign_id]);
                const isUnlocked = (campaign === null || campaign === void 0 ? void 0 : campaign.is_unlock) === 1;
                if (isUnlocked) {
                    // ========================================================
                    // 🚀 FAST PATH: ปลดล็อคแล้ว (ดึงจาก DB ตรงๆ เร็วสุดๆ)
                    // ========================================================
                    const userCodesInPage = result.data.map((r) => r.userCode); // เอาเฉพาะคนในหน้านี้ (เช่น 20 คน)
                    if (userCodesInPage.length > 0) {
                        const [booklets] = yield connection.query(`SELECT user_code, qr_payload FROM booklets WHERE session_id = ? AND user_code IN (?)`, [session_id, userCodesInPage]);
                        // สร้าง Map จับคู่ user_code กับ qr_payload
                        const fastQrMap = new Map(booklets.map(b => [b.user_code, b.qr_payload]));
                        result.data = result.data.map((row) => (Object.assign(Object.assign({}, row), { qr_payload: fastQrMap.get(row.userCode) ? key_service_1.keyService.maskQrPayload(fastQrMap.get(row.userCode)) : null })));
                    }
                }
                else {
                    // ========================================================
                    // 🐢 CACHE PATH: ยังเป็น Blind Mode (ต้องถอดรหัสผ่าน Worker)
                    // ========================================================
                    const now = Date.now();
                    let cachedData = this.sessionQrCache.get(session_id);
                    // ถ้าไม่มี Cache หรือ Cache หมดอายุ ให้ถอดรหัสใหม่ทั้งหมดผ่าน Worker
                    if (!cachedData || (now - cachedData.timestamp > this.CACHE_TTL)) {
                        const booklets = yield booklets_repo_1.default.findPayloadsBySessionId(connection, session_id);
                        // 🚀 1. โยนงานถอดรหัสที่กิน CPU ไปให้ Worker ทำงานแทน!
                        // ส่งอาเรย์ว่าง [] ไป เพื่อให้มันถอดรหัสทั้งก้อนเก็บไว้ใน Cache เลย
                        const decryptedResults = yield SignSheetService.runDecryptWorker(booklets, campaign_id, []);
                        // 2. เอาผลลัพธ์จาก Worker มาสร้างเป็น Map
                        const newQrMap = new Map();
                        decryptedResults.forEach((item) => {
                            newQrMap.set(String(item.uid), item.qr_payload);
                        });
                        // 3. บันทึกลง Cache (จำไว้ใช้ 5 นาที)
                        cachedData = { map: newQrMap, timestamp: now };
                        this.sessionQrCache.set(session_id, cachedData);
                    }
                    // 4. ประกอบร่างข้อมูลด้วย Cache (เร็วปรื๊ด 0.01 วิ)
                    const cachedQrMap = cachedData.map;
                    result.data = result.data.map((row) => {
                        //  เปลี่ยนเป็น userCode ให้ตรงกับไส้ใน QR
                        const uidString = String(row.userCode);
                        const rawQrPayload = cachedQrMap.get(uidString);
                        return Object.assign(Object.assign({}, row), { qr_payload: rawQrPayload ? key_service_1.keyService.maskQrPayload(rawQrPayload) : null });
                    });
                }
            }
            catch (err) {
                console.warn(`[SignSheetService] Warning: ${err.message}`);
                // ป้องกัน Error 500 ให้ส่งข้อมูลรายชื่อกลับไปหน้าเว็บตามปกติ (แค่ไม่มี QR)
                result.data = result.data.map((row) => (Object.assign(Object.assign({}, row), { qr_payload: null })));
            }
            finally {
                if (connection)
                    connection.release();
            }
            return result;
        });
    }
    static runDecryptWorker(booklets, campaign_id, targetUserCodes) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                const isTsNode = __filename.endsWith('.ts');
                const workerPath = path_1.default.resolve(__dirname, `decrypt-worker${isTsNode ? '.ts' : '.js'}`);
                let worker;
                if (isTsNode) {
                    // สำหรับ Environment Development (ts-node)
                    worker = new worker_threads_1.Worker(`
        require('ts-node').register();
        const { workerData } = require('worker_threads');
        require(workerData.__workerPath);
      `, {
                        eval: true,
                        workerData: { __workerPath: workerPath, booklets, campaign_id, targetUserCodes }
                    });
                }
                else {
                    // สำหรับ Production (compiled js)
                    worker = new worker_threads_1.Worker(workerPath, {
                        workerData: { booklets, campaign_id, targetUserCodes }
                    });
                }
                worker.on("message", (data) => resolve(data));
                worker.on("error", reject);
                worker.on("exit", (code) => {
                    if (code !== 0)
                        reject(new Error(`Worker stopped with exit code ${code}`));
                });
            });
        });
    }
}
exports.SignSheetService = SignSheetService;
SignSheetService.sessionQrCache = new Map();
SignSheetService.CACHE_TTL = 30 * 1000; // 5 นาที  5 * 60 * 1000
