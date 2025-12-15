// src/Repo/baghandover.repo.ts
import { PoolConnection, RowDataPacket } from "mysql2/promise";

export interface BagLogDbRow extends RowDataPacket {
  id: number;
  campaign_id: number;
  session_id: number;
  bag_no: number;
  action: string;           // ISSUE | RETURN | TRANSFER
  grader_id: number | null;
  grader_name: string | null;
  operator_id: number | null;
  operator_name: string | null;
  at_time: Date | string;
  note: string | null;
}

interface IssueLogInput {
  session_id: number;
  bag_no: number;
  grader_id: number;
  operator_id: number;
  note?: string | null;
}

interface ReturnLogInput {
  session_id: number;
  bag_no: number;
  operator_id: number;
  note?: string | null;
}

class BagLogRepo {
  /**
   * ดึง log ทั้งหมดของ campaign หนึ่ง (ใช้ไปสรุป locks + logs)
   */
  async findByCampaignId(
    campaignIdNumeric: number,
    connection: PoolConnection
  ): Promise<BagLogDbRow[]> {
    const sql = `
      SELECT
        bl.id,
        s.campaign_id,
        bl.session_id,
        bl.bag_no,
        bl.action,
        bl.grader_id,
        ag.full_name AS grader_name,   -- ✅ เอาชื่อจาก accounts อย่างเดียว
        bl.operator_id,
        ao.full_name AS operator_name,
        bl.at_time,
        bl.note
      FROM bag_logs bl
      JOIN sessions s
        ON bl.session_id = s.id
      LEFT JOIN graders g
        ON bl.grader_id = g.id
      LEFT JOIN accounts ag
        ON g.account_id = ag.id       -- ชื่อผู้ตรวจ (จาก accounts)
      LEFT JOIN accounts ao
        ON bl.operator_id = ao.id     -- ชื่อ operator (จาก accounts)
      WHERE s.campaign_id = ?
      ORDER BY bl.at_time ASC, bl.id ASC;
    `;
    const [rows] = await connection.query(sql, [campaignIdNumeric]);
    return rows as BagLogDbRow[];
  }

  /**
   * Insert log action = ISSUE (ลงทะเบียนถุงให้ผู้ตรวจ)
   */
  async insertIssueLog(
    input: IssueLogInput,
    connection: PoolConnection
  ) {
    const sql = `
      INSERT INTO bag_logs (session_id, bag_no, action, grader_id, operator_id, note)
      VALUES (?, ?, 'ISSUE', ?, ?, ?);
    `;
    const params = [
      input.session_id,
      input.bag_no,
      input.grader_id,
      input.operator_id,
      input.note ?? null,
    ];
    await connection.execute(sql, params);
  }

  /**
   * Insert log action = RETURN (รับคืนถุง)
   */
  async insertReturnLog(
    input: ReturnLogInput,
    connection: PoolConnection
  ) {
    const sql = `
      INSERT INTO bag_logs (session_id, bag_no, action, grader_id, operator_id, note)
      VALUES (?, ?, 'RETURN', NULL, ?, ?);
    `;
    const params = [
      input.session_id,
      input.bag_no,
      input.operator_id,
      input.note ?? null,
    ];
    await connection.execute(sql, params);
  }


  /**
   * อัปเดตสถานะถุงในตาราง bags
   * status: CREATED | ISSUED | RETURNED (ตาม DDL)
   */
  async updateBagStatus(
    sessionId: number,
    bagNo: number,
    status: "CREATED" | "ISSUED" | "RETURNED",
    connection: PoolConnection
  ) {
    const sql = `
      UPDATE bags
      SET status = ?
      WHERE session_id = ? AND bag_no = ?;
    `;
    await connection.execute(sql, [status, sessionId, bagNo]);
  }

  /**
   * verify ว่าถุงนี้อยู่ใน session นี้จริงหรือไม่ (option แต่แนะนำ)
   */
  async ensureBagExists(
    sessionId: number,
    bagNo: number,
    connection: PoolConnection
  ): Promise<boolean> {
    const sql = `
      SELECT 1
      FROM bags
      WHERE session_id = ? AND bag_no = ?
      LIMIT 1;
    `;
    const [rows] = await connection.execute(sql, [sessionId, bagNo]);
    const arr = rows as RowDataPacket[];
    return arr.length > 0;
  }
}

const bagLogRepo = new BagLogRepo();
export default bagLogRepo;


    // const sql = `
    //   SELECT
    //     bl.id,
    //     s.campaign_id,
    //     bl.session_id,
    //     bl.bag_no,
    //     bl.action,
    //     bl.grader_id,
    //     ag.full_name AS grader_name,   -- ✅ เอาชื่อจาก accounts อย่างเดียว
    //     bl.operator_id,
    //     ao.full_name AS operator_name,
    //     bl.at_time,
    //     bl.note
    //   FROM bag_logs bl
    //   JOIN sessions s
    //     ON bl.session_id = s.id
    //   LEFT JOIN graders g
    //     ON bl.grader_id = g.id
    //   LEFT JOIN accounts ag
    //     ON g.account_id = ag.id       -- ชื่อผู้ตรวจ (จาก accounts)
    //   LEFT JOIN accounts ao
    //     ON bl.operator_id = ao.id     -- ชื่อ operator (จาก accounts)
    //   WHERE s.campaign_id = ?
    //   ORDER BY bl.at_time ASC, bl.id ASC;
    // `;