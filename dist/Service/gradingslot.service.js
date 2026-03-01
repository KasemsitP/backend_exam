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
                const unscoredSlot = yield gradingslot_repo_1.default.findUnscoredSlotForGrader(connection, bookletId, subjectId, questionNo, graderId);
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
}
exports.gradingService = gradingService;
