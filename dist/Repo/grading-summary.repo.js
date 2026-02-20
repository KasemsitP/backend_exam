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
exports.gradingSummaryRepo = void 0;
class GradingSummaryRepo {
    /**
     * 1. เช็คประวัติ: Grader คนนี้เคย "ยืม" ถุงนี้ไปหรือยัง?
     * (เปลี่ยนจากเช็ค Score เป็นเช็ค Log การยืม)
     */
    countScoredByGraderAndBag(connection, graderId, bagId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            // Logic: ดูว่าคนนี้เคยมี log 'ISSUE' กับถุงนี้ไหม
            const sql = `
      SELECT COUNT(*) as access_count
      FROM bag_logs
      WHERE bag_id = ? 
        AND grader_id = ?
        AND action = 'ISSUE'; -- หรือ action ที่คุณใช้ตอนยืม
    `;
            const [rows] = yield connection.query(sql, [bagId, graderId]);
            // ถ้าเคยยืม ให้ return จำนวนเล่มในถุง (สมมติว่าเขายืมไปตรวจทั้งถุง)
            const accessCount = (_b = (_a = rows[0]) === null || _a === void 0 ? void 0 : _a.access_count) !== null && _b !== void 0 ? _b : 0;
            if (accessCount > 0) {
                // หาจำนวนเล่มเพื่อโชว์ตัวเลขสวยๆ
                const [bRows] = yield connection.query(`SELECT COUNT(*) c FROM booklets WHERE bag_id = ?`, [bagId]);
                return (_d = (_c = bRows[0]) === null || _c === void 0 ? void 0 : _c.c) !== null && _d !== void 0 ? _d : 0;
            }
            return 0;
        });
    }
    /**
     * 2. ดู Progress ของถุง (แบบไม่อิง Slot)
     * หลักการ:
     * - หาว่าวิชาในถุงนี้มีกี่ข้อ (Total Questions)
     * - หาว่ามี Grader ยืมไปกี่คนแล้ว และคนเหล่านั้นรับผิดชอบข้อไหน (Assigned Count)
     */
    getBagProgress(connection, bagId) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
      SELECT 
        b.id as bag_id,
        
        -- 1. จำนวนเล่มในถุง
        (SELECT COUNT(*) FROM booklets WHERE bag_id = b.id) as booklet_count,

        -- 2. จำนวนข้อสอบทั้งหมดของวิชานี้ (Blueprint)
        (
          SELECT COUNT(*) 
          FROM subject_questions sq
          JOIN session_subjects ss ON ss.subject_id = sq.subject_id
          WHERE ss.session_id = b.session_id
        ) as total_questions,

        -- 3. จำนวน "ไม้" ที่ถูก Assign ไปแล้ว
        -- (นับว่ามี Grader กี่คนที่ยืมถุงนี้ไป และ Grader คนนั้นมีงานมอบหมายในวิชานี้)
        (
          SELECT COUNT(DISTINCT CONCAT(bl.grader_id, '-', ga.subject_question_id))
          FROM bag_logs bl
          JOIN grader_assignments ga ON ga.grader_id = bl.grader_id 
             AND ga.session_id = b.session_id -- ต้องเป็นงานของ session นี้
          WHERE bl.bag_id = b.id 
            AND bl.action = 'ISSUE'
        ) as completed_passes

      FROM bags b
      WHERE b.id = ?;
    `;
            const [rows] = yield connection.query(sql, [bagId]);
            return rows.length > 0 ? rows[0] : null;
        });
    }
}
exports.gradingSummaryRepo = new GradingSummaryRepo();
