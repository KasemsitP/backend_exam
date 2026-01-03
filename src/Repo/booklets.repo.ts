// src/Repo/booklets.repo.ts
import { PoolConnection, RowDataPacket, ResultSetHeader } from "mysql2/promise";

export interface DbBookletRow extends RowDataPacket {
  id: number;
  session_id: number;
  user_session_id: number;
  bag_no: number;
  seq_in_bag: number | null;
  status: string;
}

export interface DbBookletInBagRow extends RowDataPacket {
  booklet_id: number;
  session_id: number;
  bag_no: number;
  seq_in_bag: number | null;
  status: string;
  qr_payload: string | null;
  user_code: string;
  full_name: string;
}

class BookletsRepo {
  // หาค่า seq_in_bag สูงสุดในถุงนี้ (เผื่อมีของเก่าแล้ว จะต่อจากเลขเดิม)
  async getMaxSeqInBag(
    conn: PoolConnection,
    params: { sessionId: number; bagNo: number }
  ): Promise<number> {
    const { sessionId, bagNo } = params;

    const sql = `
      SELECT COALESCE(MAX(seq_in_bag), 0) AS max_seq
      FROM booklets
      WHERE session_id = ? AND bag_no = ?
    `;
    const [rows] = await conn.execute<RowDataPacket[]>(sql, [sessionId, bagNo]);
    const row = rows[0] as any;
    return row?.max_seq ?? 0;
  }

  async insertOne(
    conn: PoolConnection,
    params: {
      sessionId: number;
      userSessionId: number;
      bagNo: number;
      seqInBag: number;
      status: "CREATED" | "PACKAGED" | "SCANNED" | "GRADED";
    }
  ): Promise<number> {
    const { sessionId, userSessionId, bagNo, seqInBag, status } = params;

    const sql = `
      INSERT INTO booklets (
        session_id,
        user_session_id,
        bag_id,
        seq_in_bag,
        status
      ) VALUES (?, ?, ?, ?, ?)
    `;
    console.log(bagNo)
    const [result] = await conn.execute<ResultSetHeader>(sql, [
      sessionId,
      userSessionId,
      bagNo,
      seqInBag,
      status,
    ]);

    return result.insertId;
  }

  async findById(
    conn: PoolConnection,
    id: number
  ): Promise<DbBookletRow | null> {
    const sql = `
      SELECT id, session_id, user_session_id, bag_no, seq_in_bag, status
      FROM booklets
      WHERE id = ?
      LIMIT 1;
    `;
    const [rows] = await conn.execute<DbBookletRow[]>(sql, [id]);
    return rows[0] || null;
  }

  async findByCampaignSessionAndBag(
    conn: PoolConnection,
    campaignId: number,
    sessionId: number,
    bagNo: number
  ): Promise<DbBookletInBagRow[]> {
    const sql = `
SELECT
        bk.id          AS booklet_id,
        bk.session_id,
        bk.bag_id,
        bk.seq_in_bag,
        bk.status,
        us.qr_payload  AS qr_payload,
        u.user_code,
        u.full_name
      FROM booklets bk
      join bags b on b.id = bk.bag_id
      JOIN user_sessions us
        ON bk.user_session_id = us.id
      JOIN user_campaigns uc
        ON us.user_campaign_id = uc.id
      JOIN users u
        ON uc.user_id = u.id
      WHERE us.campaign_id = 1
        AND bk.session_id = 10
        AND b.bag_no   = 3
      ORDER BY bk.seq_in_bag ASC, bk.id ASC;
    `;

    const [rows] = await conn.execute<DbBookletInBagRow[]>(sql, [
      campaignId,
      sessionId,
      bagNo,
    ]);
    return rows;
  }
}



const bookletsRepo = new BookletsRepo();
export default bookletsRepo;
