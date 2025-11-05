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

// ⭐️ (FIX 2: Interface นี้สำหรับ SELECT JOIN)
interface DbBagRow extends RowDataPacket {
  id: number; // (PK)
  campaign_id: string; // (ได้มาจาก JOIN)
  session_id: string; // (ได้มาจาก JOIN)
  session_label: string; // (ได้มาจาก JOIN - s.title)
  bag_no: number; // (INT) ⭐️ (FIX: เปลี่ยนเป็น number)
  bag_no_str: string; // (ID ที่แปลงเป็น "BAG-001" แล้ว)
  count_items: number;
  status: "draft" | "ready" | "incomplete";
}

class BagRepo {

  // ⭐️ (FIX 3: REPO GET ต้อง JOIN sessions เพื่อหา campaign_id)
  async findAllByCampaignId(campaignId: string, connection: PoolConnection): Promise<DbBagRow[]> {
    // (แปลง "camp-1" เป็น 1)
    const campaignIdNumeric = parseInt(campaignId.replace("camp-", ""));
    
    // ⭐️ (FIX 7: ลบการขึ้นบรรทัดใหม่ (Newline) หน้า SELECT)
const sql = `SELECT
    b.id,
    s.campaign_id as campaign_id_db,
    b.session_id as session_id_db,
    s.title as session_label,
    b.bag_no,
    b.count_items,
    b.status,
    CONCAT('camp-', s.campaign_id) as campaign_id,
    CONCAT('sess-', b.session_id) as session_id,
    CONCAT('BAG-', LPAD(b.bag_no, 3, '0')) as bag_no_str
FROM bags b
JOIN sessions s ON b.session_id = s.id
LEFT JOIN session_subjects ss ON s.id = ss.session_id 
LEFT JOIN subjects sj ON ss.subject_id = sj.id
WHERE s.campaign_id = ?
ORDER BY b.bag_no ASC;`;

    try {
      const [rows] = await connection.execute(sql, [campaignIdNumeric]);
      return rows as DbBagRow[];
    } catch (error) {
      console.error("Repo Error (Bag FindAll):", error);
      throw error;
    }
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

    /**
     * (Update Bag Status)
     */
    async updateStatus(bagId: string, status: string, connection: PoolConnection) {
        // ⭐️ (FIX 4) อัปเดตโดยใช้ bag_no (ที่เป็น String ID)
        const sql = `UPDATE bags SET status = ? WHERE bag_no = ?;`;
        try {
            const [result] = await connection.execute(sql, [status, bagId]);
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
}

const bagRepo = new BagRepo();
export default bagRepo;

