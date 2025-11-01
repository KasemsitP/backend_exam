import { DB } from "../model/DB";
import { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";

type DbClient = Pool | PoolConnection;

export interface ApiSubjectMaster extends RowDataPacket {
  id: number;
  code: string;
  name: string;
}

class SubjectRepo {
  private pool: Pool;
  constructor() {
    this.pool = DB.getInstance();
  }

  async findByCode(
    code: string,
    dbClient: DbClient = this.pool
  ): Promise<ApiSubjectMaster | null> {
    const sql = "SELECT * FROM subjects WHERE code = ?";
    const [rows] = await dbClient.execute<ApiSubjectMaster[]>(sql, [code]);
    return rows[0] || null;
  }

  /**
   * สร้างวิชาใหม่
   */
  async create(
    payload: { code: string; name: string },
    dbClient: DbClient = this.pool
  ): Promise<ApiSubjectMaster> {
    const sql = "INSERT INTO subjects (code, name) VALUES (?, ?)";
    const [result] = await dbClient.execute<any>(sql, [
      payload.code,
      payload.name || null, // (ป้องกัน 'undefined')
    ]);
    const newId = result.insertId;
    return (await this.findById(newId, dbClient))!;
  }

  async findById(
    id: number,
    dbClient: DbClient = this.pool
  ): Promise<ApiSubjectMaster | null> {
    const sql = "SELECT * FROM subjects WHERE id = ?";
    const [rows] = await dbClient.execute<ApiSubjectMaster[]>(sql, [id]);
    return rows[0] || null;
  }

  /**
   * ⭐️ ค้นหา ถ้าเจอให้คืนค่า, ถ้าไม่เจอให้สร้าง
   * (นี่คือฟังก์ชันที่ Service เรียกใช้)
   */
  async findOrCreateByCode(
    code: string,
    name: string,
    dbClient: DbClient = this.pool
  ): Promise<ApiSubjectMaster> {
    const existing = await this.findByCode(code, dbClient);
    if (existing) {
      // (TODO: คุณอาจจะต้องเช็คว่า name ที่ส่งมาตรงกับ name ที่มีอยู่หรือไม่)
      return existing;
    }
    // ถ้าไม่เจอ สร้างใหม่
    return this.create({ code, name }, dbClient);
  }

  /**
   * [ ⭐️ ฟังก์ชันใหม่ (หรืออัปเดต) ⭐️ ]
   * ลบวิชา (รองรับ Transaction)
   */
  async delete(id: number, dbClient: DbClient = this.pool): Promise<boolean> {
    const sql = "DELETE FROM subjects WHERE id = ?";
    const [result] = await dbClient.execute<any>(sql, [id]);
    return result.affectedRows > 0;
  }
}

const subjectRepo = new SubjectRepo();
export default subjectRepo;
