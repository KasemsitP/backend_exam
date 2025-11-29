import { PoolConnection, RowDataPacket } from "mysql2/promise";

export interface ExamRoom {
  session_id: number;
  room_code: string;
  capacity: number;
}

class ExamRoomRepo {
  

  async findBySessionId(sessionId: number, connection: PoolConnection): Promise<ExamRoom[]> {
    const sql = "SELECT * FROM exam_rooms WHERE session_id = ? ORDER BY room_code ASC;";
    try {
      const [rows] = await connection.execute<RowDataPacket[]>(sql, [sessionId]);
      return rows as ExamRoom[];
    } catch (error) {
      console.error("Repo Error (Room FindAll):", error);
      throw error;
    }
  }

  // Insert หรือ Update ห้องสอบ
  async upsert(data: ExamRoom, connection: PoolConnection): Promise<any> {
    const sql = `
      INSERT INTO exam_rooms (session_id, room_code, capacity)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE capacity = VALUES(capacity);
    `;
    try {
      const [result] = await connection.execute(sql, [data.session_id, data.room_code, data.capacity]);
      return result;
    } catch (error) {
      console.error("Repo Error (Room Upsert):", error);
      throw error;
    }
  }

  // ลบห้องสอบ
  async delete(sessionId: number, roomCode: string, connection: PoolConnection): Promise<any> {
    const sql = "DELETE FROM exam_rooms WHERE session_id = ? AND room_code = ?;";
    try {
      const [result] = await connection.execute(sql, [sessionId, roomCode]);
      return result;
    } catch (error) {
      console.error("Repo Error (Room Delete):", error);
      throw error;
    }
  }
}

const examRoomRepo = new ExamRoomRepo();
export default examRoomRepo;
