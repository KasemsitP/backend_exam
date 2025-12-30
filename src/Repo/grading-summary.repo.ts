import { PoolConnection, RowDataPacket } from "mysql2/promise";

// Interface ใหม่สำหรับ Progress แบบไม่อิง Slot
export interface BagProgressRow extends RowDataPacket {
  bag_id: number;
  total_questions: number; // จำนวนข้อทั้งหมดของวิชาในถุงนี้
  completed_passes: number; // จำนวน "ไม้" ที่ถูกยืมไปแล้ว (นับตามข้อ)
  booklet_count: number; // จำนวนเล่มในถุง
}

class GradingSummaryRepo {
  /**
   * 1. เช็คประวัติ: Grader คนนี้เคย "ยืม" ถุงนี้ไปหรือยัง?
   * (เปลี่ยนจากเช็ค Score เป็นเช็ค Log การยืม)
   */
  async countScoredByGraderAndBag(
    connection: PoolConnection,
    graderId: number,
    bagId: number
  ): Promise<number> {
    // Logic: ดูว่าคนนี้เคยมี log 'ISSUE' กับถุงนี้ไหม
    const sql = `
      SELECT COUNT(*) as access_count
      FROM bag_logs
      WHERE bag_id = ? 
        AND grader_id = ?
        AND action = 'ISSUE'; -- หรือ action ที่คุณใช้ตอนยืม
    `;
    const [rows] = await connection.query<any[]>(sql, [bagId, graderId]);
    
    // ถ้าเคยยืม ให้ return จำนวนเล่มในถุง (สมมติว่าเขายืมไปตรวจทั้งถุง)
    const accessCount = rows[0]?.access_count ?? 0;
    if (accessCount > 0) {
        // หาจำนวนเล่มเพื่อโชว์ตัวเลขสวยๆ
        const [bRows] = await connection.query<any[]>(
            `SELECT COUNT(*) c FROM booklets WHERE bag_id = ?`, [bagId]
        );
        return bRows[0]?.c ?? 0; 
    }
    return 0;
  }

  /**
   * 2. ดู Progress ของถุง (แบบไม่อิง Slot)
   * หลักการ:
   * - หาว่าวิชาในถุงนี้มีกี่ข้อ (Total Questions)
   * - หาว่ามี Grader ยืมไปกี่คนแล้ว และคนเหล่านั้นรับผิดชอบข้อไหน (Assigned Count)
   */
  async getBagProgress(
    connection: PoolConnection,
    bagId: number
  ): Promise<BagProgressRow | null> {
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

    const [rows] = await connection.query<BagProgressRow[]>(sql, [bagId]);
    return rows.length > 0 ? rows[0] : null;
  }

}

export const gradingSummaryRepo = new GradingSummaryRepo();