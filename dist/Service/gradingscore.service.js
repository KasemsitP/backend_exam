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
exports.gradingScoreService = void 0;
// src/Service/gradingscore.service.ts
const DB_1 = require("../model/DB");
const gradingscore_repo_1 = __importDefault(require("../Repo/gradingscore.repo"));
const gradingrecheck_service_1 = require("./gradingrecheck.service");
class gradingScoreService {
    /**
     * บันทึกคะแนนของ slot หนึ่ง
     * 1) verify slot context (campaign/session/subject/question/grader)
     * 2) insert grading_scores
     * 3) update grading_slots.status = 'COMPLETED'
     * 4) select ข้อมูลกลับมาในรูป GradingScoreResult
     */
    static submitScore(payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const { campaignId, slotId, graderId, score, question_no } = payload;
            const conn = yield DB_1.DB.getInstance().getConnection();
            try {
                yield conn.beginTransaction();
                // 1) ตรวจว่า slot นี้เป็นของ campaign นี้ + grader นี้จริงไหม
                const isValidSlot = yield gradingscore_repo_1.default.verifySlotContext(conn, {
                    slotId,
                    campaignId,
                    graderId,
                });
                if (!isValidSlot) {
                    throw new Error("slot ไม่ตรงกับรอบสอบหรือไม่ได้ถูกมอบหมายให้ผู้ตรวจคนนี้");
                }
                const checkScoreRow = yield gradingscore_repo_1.default.CheckScore(conn, {
                    slotId,
                    question_no,
                    graderId,
                });
                const max_score = checkScoreRow ? checkScoreRow.max_score : null;
                const label = checkScoreRow ? checkScoreRow.label : null;
                const questionNo = checkScoreRow ? checkScoreRow.question_no : null;
                if (max_score === null) {
                    throw new Error("ไม่พบคะแนนเต็มสำหรับหัวข้อนี้");
                }
                if (questionNo !== question_no) {
                    throw new Error("หมายเลขหัวข้อไม่ตรงกับข้อมูลในระบบ");
                }
                if (score < 0 || score > max_score) {
                    throw new Error(`คะแนนต้องอยู่ระหว่าง 0 ถึง ${max_score} สำหรับหัวข้อ ${label}`);
                }
                // 2) insert grading_scores
                const gradingScoreId = yield gradingscore_repo_1.default.insertScore(conn, slotId, score, graderId);
                // 3) update slot status
                yield gradingscore_repo_1.default.updateSlotStatus(conn, slotId, "COMPLETED");
                yield gradingrecheck_service_1.gradingRecheckService.checkAndMarkDisputedIfNeeded(conn, slotId, 4);
                // 4) select ข้อมูลคะแนนที่เพิ่ง insert
                const row = yield gradingscore_repo_1.default.findScoreById(conn, gradingScoreId);
                if (!row) {
                    throw new Error("ไม่พบข้อมูลคะแนนที่เพิ่งบันทึก");
                }
                yield conn.commit();
                const result = {
                    gradingscoreId: row.gradingscoreId,
                    slotId: row.slotId,
                    score: Number(row.score),
                    status: row.status,
                    enteredAt: row.enteredAt,
                    graderId: row.graderId,
                    graderName: row.graderName,
                    random_num: row.random_num,
                };
                return result;
            }
            catch (error) {
                yield conn.rollback();
                throw error;
            }
            finally {
                conn.release();
            }
        });
    }
}
exports.gradingScoreService = gradingScoreService;
