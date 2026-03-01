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
            console.log("Fetching paginated user sessions with options:", options);
            // 1. ดึงข้อมูล User จาก Repo (ตอนนี้จะยังไม่มี qr_payload)
            const result = yield signsheet_repo_1.default.findUserSessionsWithPagination(session_id, campaign_id, page, limit, search);
            // ถ้าไม่มีข้อมูลเลย ให้รีเทิร์นกลับไปเลยเพื่อประหยัดเวลา
            if (result.data.length === 0) {
                return result;
            }
            // เซ็ตค่า qr_payload ตั้งต้นให้เป็น null ทุกคนเผื่อไว้ก่อน
            result.data = result.data.map((row) => (Object.assign(Object.assign({}, row), { qr_payload: null })));
            // 2. ดึง QR ของ Session นี้มาถอดรหัสเพื่อหาเจ้าของ
            let connection;
            try {
                connection = yield DB_1.DB.getInstance().getConnection();
                const booklets = yield booklets_repo_1.default.findPayloadsBySessionId(connection, session_id);
                if (booklets && booklets.length > 0) {
                    const mappedBooklets = yield Promise.all(booklets.map((b) => __awaiter(this, void 0, void 0, function* () {
                        try {
                            const decoded = yield key_service_1.keyService.decryptQrPayloadBags(b.qr_payload, campaign_id);
                            const uid = (decoded === null || decoded === void 0 ? void 0 : decoded.uid) || (decoded === null || decoded === void 0 ? void 0 : decoded.user_id) || null;
                            return { qr_payload: b.qr_payload, uid: uid };
                        }
                        catch (e) {
                            // ถ้าถอดรหัสไม่ได้ (เช่น คีย์ผิด/ไม่มีคีย์) ก็ให้ข้าม QR ดวงนี้ไปเลย
                            return { qr_payload: b.qr_payload, uid: null };
                        }
                    })));
                    // สร้าง Map สำหรับค้นหา (ข้ามคนที่ uid เป็น null)
                    const qrMap = new Map(mappedBooklets
                        .filter(mb => mb.uid !== null)
                        .map(mb => [String(mb.uid), mb.qr_payload]));
                    result.data = result.data.map((row) => {
                        const uidString = String(row.user_id);
                        const rawQrPayload = qrMap.get(uidString); // ดึงค่าจริงจาก DB
                        return Object.assign(Object.assign({}, row), { 
                            // 🛑 สวมหน้ากากตรงนี้เลย! (ถ้ามีค่า ค่อยเอาไป Mask)
                            qr_payload: rawQrPayload ? key_service_1.keyService.maskQrPayload(rawQrPayload) : null });
                    });
                }
            }
            catch (err) {
                // หาก Database Error หรือไม่มีคีย์หลัก จะตกลงมาที่นี่
                console.warn(` แจ้งเตือน: ข้ามการจับคู่ QR Code เนื่องจาก ${err.message}`);
                // ไม่ต้อง throw error ออกไป ปล่อยให้มันไหลไป return result ที่มีแค่รายชื่อ
            }
            finally {
                if (connection)
                    connection.release(); // คืน connection อย่างปลอดภัย
            }
            return result;
        });
    }
}
exports.SignSheetService = SignSheetService;
