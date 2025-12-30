import { DB } from "../model/DB";
import { gradingSummaryRepo } from "../Repo/grading-summary.repo";

export class GradingSummaryService {
    static async checkGraderHistoryInBag(graderId: number, bagId: number) {
        const connection = await DB.getInstance().getConnection();
        try {
            const count = await gradingSummaryRepo.countScoredByGraderAndBag(
                connection,
                graderId,
                bagId
            );
            return {
                graderId,
                bagId,
                scoredCount: count,
                hasGraded: count > 0, // true ถ้าเคยตรวจแล้ว
            };
        } finally {
            connection.release();
        }
    }


    static async getBagProgress(bagId: number) {
        const connection = await DB.getInstance().getConnection();
        try {
            const row = await gradingSummaryRepo.getBagProgress(connection, bagId);

            if (!row) return null; // Handle case not found

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
        } finally {
            connection.release();
        }
    }
}