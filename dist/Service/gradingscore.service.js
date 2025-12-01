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
            const { campaignId, sessionId, slotId, subjectId, questionNo, graderId, score, } = payload;
            const conn = yield DB_1.DB.getInstance().getConnection();
            try {
                yield conn.beginTransaction();
                // 1) ตรวจว่า slot ถูกต้องไหม
                const isValidSlot = yield gradingscore_repo_1.default.verifySlotContext(conn, {
                    slotId,
                    campaignId,
                    sessionId,
                    subjectId,
                    questionNo,
                    graderId,
                });
                if (!isValidSlot) {
                    throw new Error("slot ไม่ตรงกับ campaign/session/subject/question หรือไม่ได้ถูกมอบหมายให้ผู้ตรวจคนนี้");
                }
                // 2) insert grading_scores
                const gradingScoreId = yield gradingscore_repo_1.default.insertScore(conn, slotId, score, graderId);
                // 3) update slot status
                yield gradingscore_repo_1.default.updateSlotStatus(conn, slotId, "COMPLETED");
                // 4) select ข้อมูลคะแนนที่เพิ่ง insert
                const row = yield gradingscore_repo_1.default.findScoreById(conn, gradingScoreId);
                if (!row) {
                    throw new Error("ไม่พบข้อมูลคะแนนที่เพิ่งบันทึก");
                }
                yield conn.commit();
                // map Row → Result (จริง ๆ shape เดียวกันแล้ว)
                const result = {
                    gradingscoreId: row.gradingscoreId,
                    slotId: row.slotId,
                    score: Number(row.score),
                    status: row.status,
                    enteredAt: row.enteredAt,
                    graderId: row.graderId,
                    graderName: row.graderName,
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
