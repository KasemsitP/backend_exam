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
exports.gradingRecheckService = void 0;
const DB_1 = require("../model/DB");
const gradingscore_repo_1 = __importDefault(require("../Repo/gradingscore.repo"));
const gradingslot_repo_1 = __importDefault(require("../Repo/gradingslot.repo"));
const gradingslot_service_1 = require("./gradingslot.service");
class gradingRecheckService {
    static checkAndMarkDisputedIfNeeded(conn, slotId, diffThreshold) {
        return __awaiter(this, void 0, void 0, function* () {
            // 1) เอา context ของ slot นี้ก่อน
            const ctx = yield gradingscore_repo_1.default.findSlotContextById(conn, slotId);
            if (!ctx) {
                // ไม่เจอ slot ก็ไม่ทำอะไร
                return;
            }
            // 2) ดึงคะแนนของ "เล่มเดียวกัน + วิชาเดียวกัน + ข้อเดียวกัน" ทุก slot
            const scores = yield gradingscore_repo_1.default.findScoresForSlotGroup(conn, ctx.bookletId, ctx.subjectId, ctx.questionNo);
            // ถ้ายังไม่ครบ 2 คน → ยังไม่ต้องคำนวณ diff
            if (scores.length < 2)
                return;
            const numericScores = scores.map((s) => Number(s.score));
            const maxScore = Math.max(...numericScores);
            const minScore = Math.min(...numericScores);
            const diff = maxScore - minScore;
            if (diff > diffThreshold) {
                // mark ทุก slot ของข้อนี้เป็น DISPUTED
                for (const row of scores) {
                    yield gradingscore_repo_1.default.updateSlotStatus(conn, row.slotId, "DISPUTED");
                }
            }
        });
    }
    /**
     * รีเซ็ตคะแนนของข้อหนึ่ง (เล่ม + วิชา + ข้อ) เพื่อ recheck ใหม่
     * - ลบ grading_scores ทั้งหมดของข้อนี้
     * - เซ็ต status ของ slot ทั้งหมดเป็น OPEN
     */
    static resetQuestionForRecheck(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const conn = yield DB_1.DB.getInstance().getConnection();
            try {
                yield conn.beginTransaction();
                // 1) หา context จาก slotId
                const ctx = yield gradingscore_repo_1.default.findSlotContextById(conn, params.slotId);
                if (!ctx) {
                    throw new Error("ไม่พบ slot ที่ต้องการรีเซ็ต");
                }
                // 2) ดึง slot ทั้งคู่ของเล่ม+วิชา+ข้อนี้มาก่อน
                const slots = yield gradingslot_repo_1.default.findSlotsByBookletAndQuestionAndScore(conn, ctx.bookletId, ctx.subjectId, ctx.questionNo, false // ไม่ต้อง lock ก็ได้ในจังหวะนี้
                );
                if (!slots.length) {
                    throw new Error("ไม่พบ slot ของข้อนี้สำหรับ recheck");
                }
                // 3) อนุญาตให้ reset เฉพาะกรณีที่มีอย่างน้อยหนึ่ง slot เป็น DISPUTED
                const isDisputed = slots.some((s) => s.status === "DISPUTED");
                if (!isDisputed) {
                    throw new Error("ข้อนี้ยังไม่ได้ถูก mark ว่า DISPUTED จึงยังไม่เข้าเกณฑ์ recheck");
                }
                console.log("จะรีเซ็ต slotId:", params.slotId, "ของ userId:", params.userId, "ใน context:", ctx, slots);
                // await gradingscoreRepo.InsertLogForRecheck(conn, {
                //   slotId: params.slotId,
                //   userId: params.userId,
                //   bookletId: ctx.bookletId,
                //   subjectId: ctx.subjectId,
                //   questionNo: ctx.questionNo,
                //   slotId1: slots[0].id,
                //   slotId2: slots[1]?.id || 0,
                //   grader1Id: slots[0].grader_id || 0,
                //   grader2Id: slots[1]?.grader_id || 0,
                //   oldScore1: slots[0].score,
                //   oldScore2: slots[1]?.score || 0,
                //   changedBy: params.userId,
                // });
                // 4) ลบคะแนนเดิมทุกคนของข้อเดียวกัน + เล่มเดียวกัน
                yield gradingscore_repo_1.default.deleteScoresForQuestion(conn, ctx.bookletId, ctx.subjectId, ctx.questionNo);
                // 5) เซ็ต status slot ทั้งหมดของข้อนี้กลับเป็น OPEN
                yield gradingscore_repo_1.default.resetSlotsStatusForQuestion(conn, ctx.bookletId, ctx.subjectId, ctx.questionNo);
                yield conn.commit();
            }
            catch (err) {
                yield conn.rollback();
                throw err;
            }
            finally {
                conn.release();
            }
        });
    }
    /**
     * สแกน QR สำหรับ "recheck"
     * ตอนนี้ reuse logic เดิมของ gradingService.createSlotFromQr ตรง ๆ
     * - เพราะเรา reset แล้ว slot เดิมจะ status = OPEN และไม่มี score
     * - เวลา grader สแกน → allocateSlotForQuestion จะเจอ unscoredSlot ของคนเดิม แล้วคืน slotId เดิม
     * ถ้าอยากบังคับว่าใช้ได้เฉพาะ question ที่เคย DISPUTED ก็เพิ่มเงื่อนไขเช็คเพิ่มได้ในอนาคต
     */
    static createRecheckSlotFromQr(payload) {
        return __awaiter(this, void 0, void 0, function* () {
            // ตรงนี้คือ thin wrapper เฉย ๆ
            return gradingslot_service_1.gradingService.createSlotFromQr(payload);
        });
    }
    static listDisputedQuestions() {
        return __awaiter(this, arguments, void 0, function* (thresholdDiff = 4, campaign_id) {
            const conn = yield DB_1.DB.getInstance().getConnection();
            console.log(campaign_id);
            try {
                const rows = yield gradingscore_repo_1.default.findDisputedQuestions(conn, campaign_id, thresholdDiff);
                return rows;
            }
            finally {
                conn.release();
            }
        });
    }
    static EditResetScore(slotId1, slotId2, score1, score2, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const conn = yield DB_1.DB.getInstance().getConnection();
            try {
                const maxScoreRow = yield gradingscore_repo_1.default.getMaxScoreforQuestionBySlotId(conn, slotId1);
                const max_score = maxScoreRow ? maxScoreRow.max_score : null;
                if (max_score === null) {
                    throw new Error("ไม่พบคะแนนเต็มสำหรับหัวข้อนี้");
                }
                if (Math.abs(score1 - score2) > 4) {
                    throw new Error(`ความต่างของคะแนนทั้งสอง slot ต้องไม่เกิน 4 คะแนน`);
                }
                if (score1 < 0 || score1 > max_score) {
                    throw new Error(`คะแนนต้องอยู่ระหว่าง 0 ถึง ${max_score} สำหรับหัวข้อ ${maxScoreRow === null || maxScoreRow === void 0 ? void 0 : maxScoreRow.question_label}`);
                }
                if (score2 < 0 || score2 > max_score) {
                    throw new Error(`คะแนนต้องอยู่ระหว่าง 0 ถึง ${max_score} สำหรับหัวข้อ ${maxScoreRow === null || maxScoreRow === void 0 ? void 0 : maxScoreRow.question_label}`);
                }
                console.log(userId);
                const ctx = yield gradingscore_repo_1.default.findSlotContextById(conn, slotId1);
                if (!ctx) {
                    throw new Error("ไม่พบ slot ที่ต้องการรีเซ็ต");
                }
                const slots = yield gradingslot_repo_1.default.findSlotsByBookletAndQuestionAndScore(conn, ctx.bookletId, ctx.subjectId, ctx.questionNo, false // ไม่ต้อง lock ก็ได้ในจังหวะนี้
                );
                if (!slots.length) {
                    throw new Error("ไม่พบ slot ของข้อนี้สำหรับ recheck");
                }
                const isDisputed = slots.some((s) => s.status === "DISPUTED");
                if (!isDisputed) {
                    throw new Error("ข้อนี้ยังไม่ได้ถูก mark ว่า DISPUTED จึงยังไม่เข้าเกณฑ์ recheck");
                }
                yield gradingscore_repo_1.default.InsertLogForRecheck(conn, {
                    bookletId: ctx.bookletId,
                    subjectId: ctx.subjectId,
                    questionNo: ctx.questionNo,
                    slotId1: slots[0].id,
                    slotId2: ((_a = slots[1]) === null || _a === void 0 ? void 0 : _a.id) || 0,
                    grader1Id: slots[0].grader_id || 0,
                    grader2Id: ((_b = slots[1]) === null || _b === void 0 ? void 0 : _b.grader_id) || 0,
                    oldScore1: slots[0].score,
                    oldScore2: ((_c = slots[1]) === null || _c === void 0 ? void 0 : _c.score) || 0,
                    changedBy: userId
                });
                yield gradingscore_repo_1.default.ResetScoreEdit(conn, slotId1, slotId2, score1, score2);
                yield conn.commit();
            }
            catch (err) {
                yield conn.rollback();
                throw err;
            }
            finally {
                conn.release();
            }
        });
    }
}
exports.gradingRecheckService = gradingRecheckService;
