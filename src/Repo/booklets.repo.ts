// src/Repo/booklets.repo.ts
import { PoolConnection, RowDataPacket, ResultSetHeader, Pool } from "mysql2/promise";
import { DB } from "../model/DB";

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

interface QrPayloadRow extends RowDataPacket {
  qr_payload: string;
}


class BookletsRepo {
  private pool: Pool;
  constructor() {
    this.pool = DB.getInstance();
  }
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
  ): Promise<any[]> { // แนะนำให้ใช้ Type ที่เอา user_code กับ full_name ออกแล้ว
    const sql = `
      SELECT
        bk.id          AS booklet_id,
        bk.session_id,
        bk.bag_id,
        bk.seq_in_bag,
        bk.status,
        bk.random_num,
        bk.qr_payload,
        bk.created_at,
        b.bag_no
      FROM booklets bk
      JOIN bags b ON b.id = bk.bag_id
      JOIN sessions s ON bk.session_id = s.id
      WHERE s.campaign_id = ?
        AND bk.session_id = ?
        AND b.bag_no   = ?
      ORDER BY bk.seq_in_bag ASC, bk.id ASC;
    `;

    const [rows] = await conn.execute<any[]>(sql, [
      campaignId,
      sessionId,
      bagNo,
    ]);
    return rows;
  }

  // 4. หา Booklet ด้วย QR Payload
  async findBookletsbyQRpayload(
    conn: PoolConnection,
    qrPayload: string
  ): Promise<DbBookletRow | null> {
    const sql = `
      SELECT 
        bk.id, 
        bk.session_id, 
        bk.bag_id, 
        bk.seq_in_bag, 
        bk.status, 
        bk.qr_payload, 
        bk.random_num, 
        bk.created_at,
        b.bag_no
      FROM booklets bk
      JOIN bags b ON b.id = bk.bag_id
      WHERE qr_payload = ?
      LIMIT 1;
    `;
    const [rows] = await conn.execute<any[]>(sql, [qrPayload]);
    return rows[0] || null;
  }

  async findBookletsbyQRpayloadandBookletsID(
    conn: PoolConnection,
    qrPayload: string,
    bookletsId: number
  ): Promise<DbBookletRow | null> {
    const sql = `
SELECT 
        bk.id, 
        bk.session_id, 
        bk.bag_id, 
        bk.seq_in_bag, 
        bk.status, 
        bk.qr_payload, 
        bk.random_num, 
        bk.created_at,
        b.bag_no,
        s.name AS subject_name 
      FROM booklets bk
      JOIN bags b ON b.id = bk.bag_id
      JOIN session_subjects ss ON ss.session_id = bk.session_id
      JOIN subjects s ON ss.subject_id = s.id
      WHERE bk.qr_payload = ? 
        AND bk.id = ?
      LIMIT 1;
    `;
    const [rows] = await conn.execute<any[]>(sql, [qrPayload, bookletsId]);
    return rows[0] || null;
  }


  async getDayno(
    conn: PoolConnection,
    sessionId: number
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
    WHERE session_id = ?
      AND random_num IS NOT NULL
    ORDER BY CAST(RIGHT(random_num, 4) AS UNSIGNED) DESC
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
        update booklets set bag_id = null, seq_in_bag = null, status = 'CREATED', random_num = null
        where bag_id = ?
    `;
    // สังเกตการใช้ [values] เป็น array ซ้อน array สำหรับ mysql2 bulk insert
    await conn.query(sql, [bagId]);
  }
  async bulkInsertBooklets(
    data: { session_id: number; qr_payload: string }[],
    connection: PoolConnection
  ) {
    if (data.length === 0) return;

    // แปลง Object Array เป็น Array ของ Array สำหรับ mysql2
    const values = data.map(item => [
      item.session_id,
      item.qr_payload,
      'CREATED' // สถานะเริ่มต้นของ Booklet
    ]);

    const sql = `
        INSERT INTO booklets (session_id, qr_payload, status) 
        VALUES ?
    `;

    await connection.query(sql, [values]);
  };
  async checkIfSessionEncrypted(
    sessionId: number,
    connection: any // เปลี่ยน type ให้ตรงกับที่คุณใช้ (เช่น mysql.PoolConnection)
  ): Promise<boolean> {
    // ใช้ SELECT 1 และ LIMIT 1 เพื่อให้ Database ทำงานเร็วที่สุด แค่เจอ record เดียวก็หยุดหา
    const sql = `SELECT 1 FROM booklets WHERE session_id = ? LIMIT 1`;
    const [rows]: any = await connection.query(sql, [sessionId]);

    // ถ้ามีความยาวมากกว่า 0 แปลว่าเคยสร้างไปแล้ว คืนค่า true
    return rows.length > 0;
  };
  async findByPayloads(
    connection: PoolConnection,
    payloads: string[]
  ): Promise<DbBookletRow[]> {
    if (payloads.length === 0) return [];

    const sql = `SELECT id, session_id, bag_id, seq_in_bag, status, qr_payload, random_num, created_at FROM booklets WHERE qr_payload IN (?)`;
    const [rows] = await connection.query(sql, [payloads]);
    return rows as DbBookletRow[];
  }

  // 11. อัปเดตข้อมูล Booklet เมื่อถูกจัดลงถุง
  async updateBagInfoByPayload(
    connection: PoolConnection,
    qr_payload: string,
    bag_id: number,
    seq_in_bag: number,
    status: string,
    random_num: string,
    datetime : Date
  ): Promise<void> {
    const sql = `
        UPDATE booklets 
        SET bag_id = ?, seq_in_bag = ?, status = ?, random_num = ? , created_at = ?
        WHERE qr_payload = ?
    `;
    await connection.query(sql, [bag_id, seq_in_bag, status, random_num, datetime, qr_payload]);
  }
  async findPayloadsBySessionId(
    connection: PoolConnection,
    sessionId: number,
  ): Promise<QrPayloadRow[]> {

    const sql = `
    SELECT qr_payload
    FROM booklets
    WHERE session_id = ?
  `;

    const [rows] = await connection.execute<QrPayloadRow[]>(
      sql,
      [sessionId]
    );

    return rows;
  }

async findBlindBookletsByCampaign(conn: PoolConnection, campaignId: number) {
    const sql = `
      SELECT b.id, b.qr_payload, b.session_id 
      FROM booklets b
      JOIN sessions s ON b.session_id = s.id
      WHERE s.campaign_id = ? 
        AND b.user_code IS NULL 
    `;
    const [rows] = await conn.query<any[]>(sql, [campaignId]);
    return rows;
  }

  // อัปเดตข้อมูลการ Unblind แบบ 1 Query (แก้ไขลำดับ Parameters)
async bulkUpdateUnblindBooklets(
    conn: PoolConnection,
    updates: { bookletId: number; campaignId: number; userCode: string }[]
  ): Promise<void> {
    if (updates.length === 0) return;

    let sql = `UPDATE booklets SET `;
    
    let campaignCases = `campaign_id = CASE id `;
    let codeCases = `user_code = CASE id `;
    
    const ids: number[] = [];
    const campaignParams: any[] = [];
    const codeParams: any[] = [];

    for (const u of updates) {
      campaignCases += `WHEN ${u.bookletId} THEN ? `;
      codeCases += `WHEN ${u.bookletId} THEN ? `;
      
      campaignParams.push(u.campaignId);
      codeParams.push(u.userCode);
      ids.push(u.bookletId);
    }

    campaignCases += `END, `;
    codeCases += `END `;

    sql += `${campaignCases} ${codeCases} WHERE id IN (${ids.join(",")})`;

    const finalParams = [...campaignParams, ...codeParams];

    await conn.query(sql, finalParams);
  }
  async countByBagId(
  conn: PoolConnection,
  bagId: number
): Promise<number> {
  const sql = `
    SELECT COUNT(*) AS total
    FROM booklets
    WHERE bag_id = ?
  `;
  const [rows] = await conn.query<RowDataPacket[]>(sql, [bagId]);
  return Number(rows[0]?.total ?? 0);
}
async findRandomNumsByBagId(
  conn: PoolConnection,
  bagId: number
): Promise<number[]> {
  const sql = `
    SELECT random_num
    FROM booklets
    WHERE bag_id = ?
      AND random_num IS NOT NULL
    ORDER BY CAST(random_num AS UNSIGNED)
  `;

  const [rows] = await conn.query<any[]>(sql, [bagId]);
  return rows.map(r => Number(r.random_num));
}

}





const bookletsRepo = new BookletsRepo();
export default bookletsRepo;
