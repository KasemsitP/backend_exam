import { DB } from "../model/DB";
import { PoolConnection } from "mysql2/promise";
import { format } from "mysql2/promise";
import { RowDataPacket } from "mysql2/promise";

interface NewBagData {
  session_id: number; // (INT)
  bag_no: number;   // (INT)
  count_items: number;
  status: "draft" | "ready" | "incomplete";
}


interface DbBagRow extends RowDataPacket {
  id: number;
  campaign_id: number;
  session_id: number;
  session_label: string;
  bag_no: number;
  bag_no_str: string;
  count_items: number;
  status: "draft" | "ready" | "incomplete";
  scanned_count: number;
}


export interface BagScannedCountResult extends RowDataPacket {
  id: number;
  campaign_id: number;
  session_id: number;
  session_label: string;
  bag_no: number;
  count_items: number;
  status: string;
  bag_no_str: string;
  scanned_count: number;
}


class BagRepo {

  // ⭐️ (FIX 3: REPO GET ต้อง JOIN sessions เพื่อหา campaign_id)
  async findAllByCampaignId(campaignId: string, connection: PoolConnection): Promise<DbBagRow[]> {
    // (แปลง "camp-1" เป็น 1)
    const campaignIdNumeric = parseInt(campaignId.replace("camp-", ""));

    // ⭐️ (FIX 7: ลบการขึ้นบรรทัดใหม่ (Newline) หน้า SELECT)
//     const sql = `
// SELECT
//   b.id,
//   s.campaign_id,
//   b.session_id,
//   s.title AS session_label,
//   b.bag_no,
//   b.count_items,
//   b.status,
//   CONCAT('BAG-', LPAD(b.bag_no, 3, '0')) AS bag_no_str,
//   MIN(sj.code) AS subject_code,
//   MIN(sj.name) AS subject_name,
//   COALESCE(bs.scanned_count, 0) AS scanned_count   -- 👈 เพิ่มตรงนี้
// FROM bags b
// JOIN sessions s 
//   ON b.session_id = s.id
// LEFT JOIN session_subjects ss 
//   ON s.id = ss.session_id 
// LEFT JOIN subjects sj 
//   ON ss.subject_id = sj.id
// LEFT JOIN (                                      -- 👈 นับจำนวนเล่มในแต่ละถุง
//   SELECT
//     session_id,
//     bag_no,
//     COUNT(*) AS scanned_count
//   FROM booklets
//   GROUP BY session_id, bag_no
// ) bs
//   ON bs.session_id = b.session_id
//  AND bs.bag_no     = b.bag_no
// WHERE s.campaign_id = ?
// GROUP BY
//   b.id,
//   s.campaign_id,
//   b.session_id,
//   s.title,
//   b.bag_no,
//   b.count_items,
//   b.status,
//   bs.scanned_count
// ORDER BY
//   b.bag_no ASC;
// `;
const sql = `SELECT
  b.id,
  s.campaign_id,
  b.session_id,
  s.title AS session_label,
  b.bag_no,
  b.count_items,
  b.status,
  CONCAT('BAG-', LPAD(b.bag_no, 3, '0')) AS bag_no_str,
  MIN(sj.code) AS subject_code,
  MIN(sj.name) AS subject_name,
  MAX(COALESCE(bs.scanned_count, 0)) AS scanned_count
FROM bags b
JOIN sessions s 
  ON b.session_id = s.id
LEFT JOIN session_subjects ss 
  ON s.id = ss.session_id 
LEFT JOIN subjects sj 
  ON ss.subject_id = sj.id
LEFT JOIN (
  SELECT
    bag_id,
    COUNT(*) AS scanned_count
  FROM booklets
  WHERE bag_id IS NOT NULL
  GROUP BY bag_id
) bs
  ON bs.bag_id = b.id
WHERE s.campaign_id = ?
GROUP BY
  b.id,
  s.campaign_id,
  b.session_id,
  s.title,
  b.bag_no,
  b.count_items,
  b.status
ORDER BY
  b.bag_no ASC;
`
    ;

    try {
      const [rows] = await connection.execute(sql, [campaignIdNumeric]);
      return rows as DbBagRow[];
    } catch (error) {
      console.error("Repo Error (Bag FindAll):", error);
      throw error;
    }
  }
  async getMaxBagNoForSession(
    sessionId: number,
    connection: PoolConnection
  ): Promise<number> {
    const sql = `
      SELECT COALESCE(MAX(bag_no), 0) AS max_no
      FROM bags
      WHERE session_id = ?
      FOR UPDATE;
    `;

    const [rows] = await connection.execute<RowDataPacket[]>(sql, [sessionId]);
    const row = rows[0] as any;
    return row?.max_no ?? 0;
  }

  async bulkCreate(bags: NewBagData[], connection: PoolConnection) {
    if (bags.length === 0) return;

    const values = bags.map(b => [b.session_id, b.bag_no, b.count_items, b.status]);

    const sql = format(
      "INSERT INTO bags (session_id, bag_no, count_items, status) VALUES ?",
      [values]
    );

    try {
      const [result] = await connection.query(sql);
      return result;
    } catch (error) {
      console.error("Repo Error (Bag Bulk Create):", error);
      throw error;
    }
  }


  async updateStatus(bag_no: number, status: string, session_id: number, connection: PoolConnection) {
    const sql = `UPDATE bags SET status = ? WHERE bag_no = ? AND session_id = ?`;
    try {
      const [result] = await connection.execute(sql, [status, bag_no, session_id]);
      return result;
    } catch (error) {
      console.error("Repo Error (Bag Update Status):", error);
      throw error;
    }
  }
  async deleteById(bagNo: string, connection: PoolConnection) {
    // (ลบโดยใช้ bag_no ที่เป็น VARCHAR)
    const sql = `DELETE FROM bags WHERE bag_no = ?;`;
    try {
      const [result] = await connection.execute(sql, [bagNo]);
      return result;
    } catch (error) {
      console.error("Repo Error (Bag Delete):", error);
      throw error;
    }
  }
  async findByCampaignAndBagNo(
    conn: PoolConnection,
    campaignId: number,
    bagNo: number
  ): Promise<DbBagRow | null> {
    //     const sql = `
    //   SELECT b.id, b.session_id, b.bag_no
    //   FROM bags b
    //   JOIN sessions s
    //     ON b.session_id = s.id
    //   WHERE s.campaign_id = ?
    //     AND b.bag_no = ?
    //   LIMIT 1;
    // `;
    const sql = `
      SELECT b.id, b.session_id, b.bag_no
      FROM bags b
      JOIN sessions s
        ON b.session_id = s.id
      WHERE s.campaign_id = ?
        AND b.id = ?
      LIMIT 1;
    `;
    const [rows] = await conn.execute<DbBagRow[]>(sql, [campaignId, bagNo]);
    return rows[0] || null;
  }

  async findScannCountByCampaign(
    conn: PoolConnection,
    campaignId: number,
  ): Promise<BagScannedCountResult[] | null> {
    const sql = `
SELECT
  b.id,
  s.campaign_id,
  b.session_id,
  s.title              AS session_label,
  b.bag_no,
  b.count_items,             -- จำนวนเล่มตาม capacity
  b.status,
  LPAD(b.bag_no, 3, '0')     AS bag_no_str,
  COALESCE(bs.scanned_count,0) AS scanned_count
FROM bags b
JOIN sessions s
  ON b.session_id = s.id
LEFT JOIN (
  SELECT
    session_id,
    bag_no,
    COUNT(*) AS scanned_count
  FROM booklets
  GROUP BY session_id, bag_no
) bs
  ON bs.session_id = b.session_id
 AND bs.bag_no     = b.bag_no
WHERE s.campaign_id = ?
ORDER BY b.bag_no ASC;

    `;
    const [rows] = await conn.execute<BagScannedCountResult[]>(sql, [campaignId]);
    return rows || null;

  }
  async findById(
    connection: PoolConnection,
    id: number
  ): Promise<DbBagRow | null> {
    const sql = `
      SELECT b.*, s.campaign_id
      FROM bags b
      JOIN sessions s ON b.session_id = s.id
      WHERE b.id = ?
      LIMIT 1;
    `;
    const [rows] = await connection.execute<RowDataPacket[]>(sql, [id]);
    const arr = rows as DbBagRow[];
    return arr[0] ?? null;
  }

async findBySessionAndNo(
  connection: PoolConnection,
  sessionId: number,
  bagNo: number
): Promise<any | null> {
  // แก้ไข SQL: เพิ่ม JOIN sessions เพื่อเอา campaign_id
  const sql = `
    SELECT
      b.*,
      s.campaign_id
    FROM bags b
    JOIN sessions s ON b.session_id = s.id
    WHERE b.session_id = ? AND b.bag_no = ?
    LIMIT 1;
  `;

  const [rows] = await connection.execute(sql, [sessionId, bagNo]);
  const arr = rows as any[];
  return arr.length > 0 ? arr[0] : null;
}
}

const bagRepo = new BagRepo();
export default bagRepo;

