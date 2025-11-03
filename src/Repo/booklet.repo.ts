import { DB } from "../model/DB";
import { PoolConnection } from "mysql2/promise";

// (Interface นี้ต้องตรงกับตาราง Booklets)
interface NewBookletData {
  bag_id: string;
  user_session_id: number;
  qr_payload_raw: string;
  session_id: number;
  status: string;
}

class BookletRepo {
  /**
   * (Bulk Insert Booklets)
   */
  async bulkCreate(booklets: NewBookletData[], connection: PoolConnection) {
    if (booklets.length === 0) return;

    const sql = `
      INSERT INTO booklets (bag_id, user_session_id, qr_payload_raw, session_id, status)
      VALUES ?;
    `;
    
    // (แปลง [ {obj1}, {obj2} ] เป็น [ [val1, val2], [val1, val2] ])
    const values = booklets.map(b => [
      b.bag_id,
      b.user_session_id,
      b.qr_payload_raw,
      b.session_id,
      b.status
    ]);

    try {
      const [result] = await connection.query(sql, [values]);
      return result;
    } catch (error) {
      console.error("Repo Error (Booklet Bulk Create):", error);
      throw error;
    }
  }
}

const bookletRepo = new BookletRepo();
export default bookletRepo;
