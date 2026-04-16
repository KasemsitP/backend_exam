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
exports.gradingService = void 0;
// src/Service/gradingslot.service.ts
const DB_1 = require("../model/DB");
const gradingslot_repo_1 = __importDefault(require("../Repo/gradingslot.repo"));
const booklets_repo_1 = __importDefault(require("../Repo/booklets.repo")); // 👈 เพิ่ม import นี้เพื่อหาข้อมูลเล่มข้อสอบ
const key_service_1 = require("./key.service");
const gradingscoredraft_repo_1 = __importDefault(require("../Repo/gradingscoredraft.repo"));
class gradingService {
    static createSlotFromQr(payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const { campaignId, graderId, questionNo } = payload;
            const connection = yield DB_1.DB.getInstance().getConnection();
            const qrPayload = key_service_1.keyService.unmaskQrPayload(payload.qrPayload);
            try {
                yield connection.beginTransaction();
                const bookletRow = yield booklets_repo_1.default.findBookletsbyQRpayload(connection, qrPayload);
                if (!bookletRow) {
                    throw new Error("ไม่พบเล่มข้อสอบนี้ในระบบ หรืออาจสแกนผิด");
                }
                if (bookletRow.bag_no === null || bookletRow.bag_id === null) {
                    throw new Error("เล่มข้อสอบนี้ยังไม่ถูกจัดลงถุง ไม่สามารถสแกนได้");
                }
                const activeBag = yield gradingscoredraft_repo_1.default.findActiveBagByGraderId(connection, graderId);
                if (activeBag && activeBag.bag_id !== Number(bookletRow.bag_id)) {
                    throw new Error(`คุณกำลังตรวจถุงที่ ${activeBag.bag_no} อยู่ กรุณาตรวจถุงเดิมให้เสร็จก่อน`);
                }
                // 2)  ได้ session_id มาจากตัวกระดาษคำตอบเลย
                const sid = bookletRow.session_id;
                // 3) ดูว่า grader คนนี้ใน session นี้ ถูก assign ข้ออะไร
                const assignment = yield gradingslot_repo_1.default.findAssignmentForGraderInSession(connection, graderId, sid);
                if (!assignment || assignment.length === 0) {
                    throw new Error("ผู้ตรวจคนนี้ไม่ได้ถูกมอบหมายให้ตรวจข้อสอบในรอบนี้");
                }
                const qNo = Number(questionNo);
                const question = assignment.find(a => a.question_no === qNo);
                if (!question) {
                    throw new Error("ข้อที่เลือกไม่ได้ถูกมอบหมายให้คุณตรวจ");
                }
                const activeLock = yield gradingslot_repo_1.default.findActiveLockByGraderId(connection, graderId);
                if (!activeLock) {
                    yield gradingslot_repo_1.default.createLock(connection, {
                        graderId,
                        campaignId,
                        bagId: Number(bookletRow.bag_id),
                        questionNo: Number(questionNo),
                        createdBy: null,
                    });
                }
                else {
                    const sameBag = Number(activeLock.bag_id) === Number(bookletRow.bag_id);
                    const sameQuestion = Number(activeLock.question_no) === Number(questionNo);
                    if (!sameBag) {
                        throw new Error(`คุณกำลังตรวจถุง ${activeLock.bag_id} อยู่ กรุณาตรวจถุงเดิมให้เสร็จก่อน`);
                    }
                    if (!sameQuestion) {
                        throw new Error(`คุณกำลังตรวจข้อ ${activeLock.question_no} อยู่ กรุณาตรวจข้อนี้ให้เสร็จก่อน`);
                    }
                }
                // 4) จอง slot ตามวิชากับข้อที่ assign ไว้
                const slot = yield gradingService.allocateSlotForQuestion({
                    bookletId: bookletRow.id, // ใช้ id จาก booklets
                    subjectId: question.subject_id,
                    questionNo: question.question_no,
                    graderId,
                }, connection);
                yield connection.commit();
                return {
                    slotId: slot.slotId,
                    graderOrder: slot.graderOrder,
                    status: slot.status,
                    bookletId: bookletRow.id,
                    examCode: bookletRow.random_num, // ส่งเลขสุ่มกลับไป
                    subjectId: question.subject_id,
                    questionNo,
                    bagId: bookletRow.bag_id,
                    bagNo: bookletRow.bag_no,
                    random_num: bookletRow.random_num
                };
            }
            catch (err) {
                yield connection.rollback();
                throw err;
            }
            finally {
                connection.release();
            }
        });
    }
    /**
     * core logic: 1 ข้อ = 2 slot, ห้ามคนเดิมซ้ำ
     * แยกออกมาเผื่ออยาก reuse ในกรณีที่ไม่ได้มาจาก QR
     */
    static allocateSlotForQuestion(params, conn) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { bookletId, subjectId, questionNo, graderId } = params;
            const connection = conn || (yield DB_1.DB.getInstance().getConnection());
            let createdConnection = false;
            if (!conn) {
                createdConnection = true;
                yield connection.beginTransaction();
            }
            try {
                console.log(bookletId, subjectId, questionNo, graderId);
                const unscoredSlot = yield gradingscoredraft_repo_1.default.findUnscoredSlotForGrader(connection, bookletId, subjectId, questionNo, graderId);
                console.log("Unscored Slot Check:", unscoredSlot);
                if (unscoredSlot) {
                    // เคส: สแกนซ้ำ / หน้าเด้ง แต่ยังไม่เคยบันทึก score
                    if (createdConnection) {
                        yield connection.commit();
                    }
                    return {
                        slotId: unscoredSlot.id,
                        graderOrder: (_a = unscoredSlot.grader_order) !== null && _a !== void 0 ? _a : 1,
                        status: unscoredSlot.status,
                    };
                }
                // ดึง slot เดิมของเล่มนี้ + วิชานี้ + ข้อนี้ (LOCK)
                const existingSlots = yield gradingslot_repo_1.default.findSlotsByBookletAndQuestion(connection, bookletId, subjectId, questionNo, true);
                const alreadyHasThisGrader = existingSlots.some((s) => s.grader_id === graderId);
                console.log("Existing Slots for this Question:", existingSlots);
                if (alreadyHasThisGrader) {
                    throw new Error("คุณเคยตรวจข้อสอบเล่มนี้แล้ว! ไม่สามารถตรวจซ้ำได้");
                }
                if (existingSlots.length >= 2) {
                    throw new Error("ข้อนี้มีผู้ตรวจครบ 2 คนแล้ว");
                }
                const existingOrders = new Set(existingSlots.map((s) => Number(s.grader_order)));
                let graderOrder;
                if (!existingOrders.has(1)) {
                    graderOrder = 1;
                }
                else if (!existingOrders.has(2)) {
                    graderOrder = 2;
                }
                else {
                    throw new Error("ไม่สามารถกำหนดลำดับผู้ตรวจได้ (slot เต็มแล้ว)");
                }
                const newSlot = yield gradingslot_repo_1.default.insertSlot(connection, bookletId, subjectId, questionNo, graderOrder, graderId);
                if (createdConnection) {
                    yield connection.commit();
                }
                return {
                    slotId: newSlot.id,
                    graderOrder: newSlot.grader_order,
                    status: newSlot.status,
                };
            }
            catch (err) {
                if (createdConnection) {
                    yield connection.rollback();
                }
                throw err;
            }
            finally {
                if (createdConnection) {
                    connection.release();
                }
            }
        });
    }
    static previewStartFromQr(payload) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const { campaignId, graderId, questionNo } = payload;
            const connection = yield DB_1.DB.getInstance().getConnection();
            try {
                const qrPayload = key_service_1.keyService.unmaskQrPayload(payload.qrPayload);
                const bookletRow = yield booklets_repo_1.default.findBookletsbyQRpayload(connection, qrPayload);
                if (!bookletRow) {
                    throw new Error("ไม่พบเล่มข้อสอบนี้ในระบบ หรืออาจสแกนผิด");
                }
                if (bookletRow.bag_no === null || bookletRow.bag_id === null) {
                    throw new Error("เล่มข้อสอบนี้ยังไม่ถูกจัดลงถุง ไม่สามารถสแกนได้");
                }
                const sid = bookletRow.session_id;
                const assignment = yield gradingslot_repo_1.default.findAssignmentForGraderInSession(connection, graderId, sid);
                if (!assignment || assignment.length === 0) {
                    throw new Error("ผู้ตรวจคนนี้ไม่ได้ถูกมอบหมายให้ตรวจข้อสอบในรอบนี้");
                }
                const qNo = Number(questionNo);
                const question = assignment.find((a) => a.question_no === qNo);
                if (!question) {
                    throw new Error("ข้อที่เลือกไม่ได้ถูกมอบหมายให้คุณตรวจ");
                }
                const activeLockByBagQuestion = yield gradingslot_repo_1.default.findActiveLockByBagAndQuestion(connection, Number(bookletRow.bag_id), Number(question.question_no));
                if (activeLockByBagQuestion &&
                    Number(activeLockByBagQuestion.grader_id) !== Number(graderId)) {
                    throw new Error("มีผู้ตรวจคนอื่นกำลังตรวจข้อสอบถุงนี้อยู่ กรุณาติดต่อเจ้าหน้าที่");
                }
                // เช็ค lock งานปัจจุบัน
                const activeLock = yield gradingslot_repo_1.default.findActiveLockByGraderId(connection, graderId);
                if (activeLock) {
                    const sameBag = Number(activeLock.bag_id) === Number(bookletRow.bag_id);
                    const sameQuestion = Number(activeLock.question_no) === Number(question.question_no);
                    if (!sameBag) {
                        throw new Error(`คุณกำลังตรวจถุงที่ ${activeLock.bag_id} อยู่ กรุณาตรวจถุงเดิมให้เสร็จก่อน`);
                    }
                    if (!sameQuestion) {
                        throw new Error(`คุณกำลังตรวจข้อ ${activeLock.question_no} อยู่ กรุณาตรวจข้อนี้ให้เสร็จก่อน`);
                    }
                }
                const totalBooklets = yield booklets_repo_1.default.countByBagId(connection, Number(bookletRow.bag_id));
                const randomNums = yield booklets_repo_1.default.findRandomNumsByBagId(connection, Number(bookletRow.bag_id));
                const min_random = randomNums.length > 0 ? Math.min(...randomNums) : null;
                const max_random = randomNums.length > 0 ? Math.max(...randomNums) : null;
                return {
                    canStart: true,
                    bagId: Number(bookletRow.bag_id),
                    bagNo: Number(bookletRow.bag_no),
                    bookletId: Number(bookletRow.id),
                    random_num: bookletRow.random_num,
                    examCode: bookletRow.random_num,
                    subjectId: Number(question.subject_id),
                    subjectName: (_a = question.subject_name) !== null && _a !== void 0 ? _a : "-",
                    questionNo: Number(question.question_no),
                    questionLabel: (_b = question.question_label) !== null && _b !== void 0 ? _b : null,
                    graderId,
                    totalBooklets: Number(totalBooklets !== null && totalBooklets !== void 0 ? totalBooklets : 0),
                    min_random,
                    max_random,
                    message: "พร้อมเริ่มตรวจถุงนี้",
                };
            }
            finally {
                connection.release();
            }
        });
    }
    static confirmStartFromQr(payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const { campaignId, graderId, questionNo } = payload;
            const connection = yield DB_1.DB.getInstance().getConnection();
            try {
                yield connection.beginTransaction();
                const qrPayload = key_service_1.keyService.unmaskQrPayload(payload.qrPayload);
                const bookletRow = yield booklets_repo_1.default.findBookletsbyQRpayload(connection, qrPayload);
                if (!bookletRow) {
                    throw new Error("ไม่พบเล่มข้อสอบนี้ในระบบ หรืออาจสแกนผิด");
                }
                if (bookletRow.bag_no === null || bookletRow.bag_id === null) {
                    throw new Error("เล่มข้อสอบนี้ยังไม่ถูกจัดลงถุง ไม่สามารถสแกนได้");
                }
                const sid = bookletRow.session_id;
                const assignment = yield gradingslot_repo_1.default.findAssignmentForGraderInSession(connection, graderId, sid);
                if (!assignment || assignment.length === 0) {
                    throw new Error("ผู้ตรวจคนนี้ไม่ได้ถูกมอบหมายให้ตรวจข้อสอบในรอบนี้");
                }
                const qNo = Number(questionNo);
                const question = assignment.find((a) => a.question_no === qNo);
                if (!question) {
                    throw new Error("ข้อที่เลือกไม่ได้ถูกมอบหมายให้คุณตรวจ");
                }
                // เช็ค / สร้าง lock
                const activeLock = yield gradingslot_repo_1.default.findActiveLockByGraderId(connection, graderId);
                if (!activeLock) {
                    yield gradingslot_repo_1.default.createLock(connection, {
                        graderId,
                        campaignId,
                        bagId: Number(bookletRow.bag_id),
                        questionNo: Number(question.question_no),
                    });
                }
                else {
                    const sameBag = Number(activeLock.bag_id) === Number(bookletRow.bag_id);
                    const sameQuestion = Number(activeLock.question_no) === Number(question.question_no);
                    if (!sameBag) {
                        throw new Error(`คุณกำลังตรวจถุงที่ ${activeLock.bag_id} อยู่ กรุณาตรวจถุงเดิมให้เสร็จก่อน`);
                    }
                    if (!sameQuestion) {
                        throw new Error(`คุณกำลังตรวจข้อ ${activeLock.question_no} อยู่ กรุณาตรวจข้อนี้ให้เสร็จก่อน`);
                    }
                }
                const slot = yield gradingService.allocateSlotForQuestion({
                    bookletId: Number(bookletRow.id),
                    subjectId: Number(question.subject_id),
                    questionNo: Number(question.question_no),
                    graderId,
                }, connection);
                yield connection.commit();
                return {
                    slotId: slot.slotId,
                    graderOrder: slot.graderOrder,
                    status: slot.status,
                    bookletId: Number(bookletRow.id),
                    examCode: bookletRow.random_num,
                    subjectId: Number(question.subject_id),
                    questionNo: Number(question.question_no),
                    bagId: Number(bookletRow.bag_id),
                    bagNo: Number(bookletRow.bag_no),
                    random_num: bookletRow.random_num,
                };
            }
            catch (err) {
                yield connection.rollback();
                throw err;
            }
            finally {
                connection.release();
            }
        });
    }
}
exports.gradingService = gradingService;
