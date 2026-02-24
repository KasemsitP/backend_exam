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
  random_num: string;
  qr_payload: string | null;
  user_code: string;
  full_name: string;
}
interface SessionRow extends RowDataPacket {
  session_id: number;
  day_no: number;
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
      created_at: Date;
      random_num: string;
    }
  ): Promise<number> {
    const { sessionId, userSessionId, bagNo, seqInBag, status, created_at, random_num } = params;

    const sql = `
      INSERT INTO booklets (
        session_id,
        user_session_id,
        bag_id,
        seq_in_bag,
        status,
        created_at,
        random_num
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    console.log(bagNo)
    const [result] = await conn.execute<ResultSetHeader>(sql, [
      sessionId,
      userSessionId,
      bagNo,
      seqInBag,
      status,
      created_at,
      random_num,
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
        bk.random_num,
        us.qr_payload  AS qr_payload,
        u.user_code,
        u.full_name,
        bk.created_at
      FROM booklets bk
      join bags b on b.id = bk.bag_id
      JOIN user_sessions us
        ON bk.user_session_id = us.id
      JOIN user_campaigns uc
        ON us.user_campaign_id = uc.id
      JOIN users u
        ON uc.user_id = u.id
      WHERE us.campaign_id = ?
        AND bk.session_id = ?
        AND b.bag_no   = ?
      ORDER BY bk.seq_in_bag ASC, bk.id ASC;
    `;

    const [rows] = await conn.execute<DbBookletInBagRow[]>(sql, [
      campaignId,
      sessionId,
      bagNo,
    ]);
    return rows;
  }


  async findBookletsbyQRpayload(
    conn: PoolConnection,
    campaignId: number,
    sessionId: number,
    user_code: string,
  ): Promise<DbBookletInBagRow | null> {
    const sql = `
SELECT
        bk.id          AS booklet_id,
        bk.session_id,
        bk.bag_id,
        bk.seq_in_bag,
        bk.status,
        us.qr_payload  AS qr_payload,
        u.user_code,
        u.full_name,
        b.bag_no,
        bk.created_at
      FROM booklets bk
      join bags b on b.id = bk.bag_id
      JOIN user_sessions us
        ON bk.user_session_id = us.id
      JOIN user_campaigns uc
        ON us.user_campaign_id = uc.id
      JOIN users u
        ON uc.user_id = u.id
      WHERE us.campaign_id = ?
        AND bk.session_id = ?
        AND u.user_code = ?
      ORDER BY bk.seq_in_bag ASC, bk.id ASC;
    `;

    const [rows] = await conn.execute<DbBookletInBagRow[]>(sql, [
      campaignId,
      sessionId,
      user_code,
    ]);
    return rows[0] || null;
  }

  async getDayno(
    conn: PoolConnection,
    sessionId : number
  ): Promise<SessionRow | null> {

    const sql = `
      SELECT id as session_id, day_no from sessions WHERE id = ? limit 1;
    `;

    const [rows] = await conn.execute<SessionRow[]>(sql, [
      sessionId,
    ]);

    return rows[0] || null;
  }

async getLatestRandomNumForUpdate(connection: any, sessionId: string | number) {
    const query = `
        SELECT random_num 
        FROM booklets 
        WHERE session_id = ? AND random_num IS NOT NULL
        ORDER BY id DESC 
        LIMIT 1 
        FOR UPDATE
    `;
    
    const [rows] = await connection.query(query, [sessionId]);
    
    return rows.length > 0 ? rows[0] : null;
}
async insertMany(conn: PoolConnection, values: any[][]): Promise<void> {
    const sql = `
        INSERT INTO booklets 
        (session_id, user_session_id, bag_id, seq_in_bag, status, created_at, random_num) 
        VALUES ?
    `;
    // สังเกตการใช้ [values] เป็น array ซ้อน array สำหรับ mysql2 bulk insert
    await conn.query(sql, [values]); 
}

async deleteByBagId(conn: PoolConnection, bagId: number): Promise<void> {
    const sql = `
        DELETE FROM booklets
        WHERE bag_id = ?
    `;
    // สังเกตการใช้ [values] เป็น array ซ้อน array สำหรับ mysql2 bulk insert
    await conn.query(sql, [bagId]); 
}
}





const bookletsRepo = new BookletsRepo();
export default bookletsRepo;
