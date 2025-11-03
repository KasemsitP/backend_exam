import { DB } from "../model/DB";
import { PoolConnection } from "mysql2/promise";
import { format } from "mysql2/promise";
import { RowDataPacket } from "mysql2/promise";

// ⭐️ (FIX 1) แก้ไข Interface ให้ตรงกับ Schema
interface NewBagData {
    session_id: number; // (INT)
    bag_no: number;   // (INT)
    count_items: number;
    status: "draft" | "ready" | "incomplete";
}

interface DbBagRow extends RowDataPacket {
    id: number; // (PK)
    campaign_id: string;
    session_id: string;
    session_label: string;
    subject_code: string | null;
    subject_name: string | null;
    bag_no: string; // (VARCHAR)
    count_items: number;
    status: "draft" | "ready" | "incomplete";
}

class BagRepo {
    async findAllByCampaignId(campaignId: string, connection: PoolConnection): Promise<DbBagRow[]> {
        // (แปลง "camp-1" เป็น 1)
        const campaignIdNumeric = parseInt(campaignId.replace("camp-", ""));

        const sql = `
      SELECT 
        b.id, 
        s.campaign_id as campaign_id_db, 
        b.session_id as session_id_db,
        s.session_label, 
        sj.code as subject_code, 
        sj.name as subject_name,
        b.bag_no, 
        b.count_items, 
        b.status,
        
        -- (แปลง ID กลับเป็น String ให้ Service)
        CONCAT('camp-', s.campaign_id) as campaign_id,
        CONCAT('sess-', b.session_id) as session_id

      FROM bags b
      JOIN sessions s ON b.session_id = s.id
      LEFT JOIN subjects sj ON s.subject_id = sj.id -- (สมมติว่า session link กับ subject)
      WHERE s.campaign_id = ?
      ORDER BY b.bag_no ASC;
    `;
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

