// src/Repo/baghandover.repo.ts
import { PoolConnection, RowDataPacket } from "mysql2/promise";

export interface BagLogDbRow extends RowDataPacket {
  id: number;
  campaign_id: number;
  session_id: number;
  bag_no: number;
  bag_id: number; // เพิ่ม bag_id เพื่อความชัดเจน
  action: string;
  grader_id: number | null;
  grader_name: string | null;
  operator_id: number | null;
  operator_name: string | null;
  at_time: Date | string;
  note: string | null;
}

interface IssueLogInput {
  bag_id: number; // แก้จาก session_id, bag_no เป็น bag_id
  grader_id: number;
  operator_id: number;
  note?: string | null;
}

interface ReturnLogInput {
  bag_id: number; // แก้จาก session_id, bag_no เป็น bag_id
  operator_id: number;
  note?: string | null;
}

class BagLogRepo {
  /**
   * ดึง log ทั้งหมดของ campaign
   * แก้ไข: JOIN จาก bag_logs -> bags -> sessions
   */
  async findByCampaignId(
    campaignIdNumeric: number,
    connection: PoolConnection
  ): Promise<BagLogDbRow[]> {
    const sql = `
      SELECT
        bl.id,
        s.campaign_id,
        b.session_id,       -- ดึงจาก bags
        b.bag_no,           -- ดึงจาก bags
        bl.bag_id,
        bl.action,
        bl.grader_id,
        ag.full_name AS grader_name,
        bl.operator_id,
        ao.full_name AS operator_name,
        bl.at_time,
        bl.note
      FROM bag_logs bl
      JOIN bags b ON bl.bag_id = b.id        -- JOIN bags ด้วย bag_id
      JOIN sessions s ON b.session_id = s.id -- JOIN sessions ต่อจาก bags
      LEFT JOIN graders g ON bl.grader_id = g.id
      LEFT JOIN accounts ag ON g.account_id = ag.id
      LEFT JOIN accounts ao ON bl.operator_id = ao.id
      WHERE s.campaign_id = ?
      ORDER BY bl.at_time ASC, bl.id ASC;
    `;
    const [rows] = await connection.query(sql, [campaignIdNumeric]);
    return rows as BagLogDbRow[];
  }

  /**
   * Insert log action = ISSUE
   * แก้ไข: Insert ลง column bag_id
   */
  async insertIssueLog(
    input: IssueLogInput,
    connection: PoolConnection
  ) {
    const sql = `
      INSERT INTO bag_logs (bag_id, action, grader_id, operator_id, note)
      VALUES (?, 'ISSUE', ?, ?, ?);
    `;
    const params = [
      input.bag_id,
      input.grader_id,
      input.operator_id,
      input.note ?? null,
    ];
    await connection.execute(sql, params);
  }

  /**
   * Insert log action = RETURN
   * แก้ไข: Insert ลง column bag_id
   */
  async insertReturnLog(
    input: ReturnLogInput,
    connection: PoolConnection
  ) {
    const sql = `
      INSERT INTO bag_logs (bag_id, action, grader_id, operator_id, note)
      VALUES (?, 'RETURN', NULL, ?, ?);
    `;
    const params = [
      input.bag_id,
      input.operator_id,
      input.note ?? null,
    ];
    await connection.execute(sql, params);
  }

  /**
   * อัปเดตสถานะถุงในตาราง bags
   * ปรับปรุง: ใช้ bag_id (PK) ในการ update เพื่อความแม่นยำและเร็วขึ้น
   */
  async updateBagStatus(
    bagId: number,
    status: "CREATED" | "ISSUED" | "RETURNED",
    connection: PoolConnection
  ) {
    const sql = `
      UPDATE bags
      SET status = ?
      WHERE id = ?;
    `;
    await connection.execute(sql, [status, bagId]);
  }
}

const bagLogRepo = new BagLogRepo();
export default bagLogRepo;