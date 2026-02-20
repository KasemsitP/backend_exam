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
Object.defineProperty(exports, "__esModule", { value: true });
exports.GradingSummaryService = void 0;
const DB_1 = require("../model/DB");
const grading_summary_repo_1 = require("../Repo/grading-summary.repo");
class GradingSummaryService {
    static checkGraderHistoryInBag(graderId, bagId) {
        return __awaiter(this, void 0, void 0, function* () {
            const connection = yield DB_1.DB.getInstance().getConnection();
            try {
                const count = yield grading_summary_repo_1.gradingSummaryRepo.countScoredByGraderAndBag(connection, graderId, bagId);
                return {
                    graderId,
                    bagId,
                    scoredCount: count,
                    hasGraded: count > 0, // true ถ้าเคยตรวจแล้ว
                };
            }
            finally {
                connection.release();
            }
        });
    }
    static getBagProgress(bagId) {
        return __awaiter(this, void 0, void 0, function* () {
            const connection = yield DB_1.DB.getInstance().getConnection();
            try {
                const row = yield grading_summary_repo_1.gradingSummaryRepo.getBagProgress(connection, bagId);
                if (!row)
                    return null; // Handle case not found
                const bookletCount = Number(row.booklet_count);
                const totalQuestions = Number(row.total_questions);
                // เป้าหมาย: ต้องตรวจทั้งหมดกี่ไม้?
                // สูตร: (จำนวนข้อ) x 2 (เพราะ Double Blind)
                // *หมายเหตุ: ถ้า 1 ข้อ ตรวจ 2 คน, มี 2 ข้อ ก็ต้องใช้ 4 คน (หรือ 4 assignments)
                const targetPasses = totalQuestions * 2;
                const currentPasses = Number(row.completed_passes);
                // คำนวณยอดคงเหลือ
                // unassigned ในบริบทนี้คือ "จำนวนไม้ที่ขาด"
                const remainingPasses = Math.max(0, targetPasses - currentPasses);
                // Map เข้า Interface เดิมของ Frontend (อาจจะดูแปลกๆ หน่อยแต่เพื่อให้ UI เดิมทำงานได้)
                return {
                    bagId,
                    totalItems: totalQuestions, // โชว์จำนวนข้อแทน
                    fullyAssigned: Math.floor(currentPasses / 2), // คร่าวๆ
                    halfAssigned: currentPasses % 2,
                    unassigned: remainingPasses, // สิ่งที่ Frontend จะเอาไปคูณ 2 แต่เราส่ง remaining ไปเลยดีกว่า
                    // แนะนำให้ปรับ Frontend นิดหน่อย หรือส่งค่าแบบหลอกๆ ไปให้ UI คำนวณถูก
                    status: remainingPasses === 0 ? "COMPLETED" : "IN_PROGRESS"
                };
            }
            finally {
                connection.release();
            }
        });
    }
}
exports.GradingSummaryService = GradingSummaryService;
