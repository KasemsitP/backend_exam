// src/Repo/examRoom.repo.ts
import { PoolConnection, RowDataPacket } from "mysql2/promise";

export interface ExamRoom {
  campaign_id: number;
  room_code: string;
  capacity: number;
}

class ExamRoomRepo {
  // ดึงห้องสอบทั้งหมดของ campaign นั้น ๆ
  async findByCampaignId(
    campaignId: number,
    connection: PoolConnection
  ): Promise<ExamRoom[]> {
    const sql =
      "SELECT campaign_id, room_code, capacity FROM exam_rooms WHERE campaign_id = ? ORDER BY room_code ASC;";
    try {
      const [rows] = await connection.execute<RowDataPacket[]>(sql, [
        campaignId,
      ]);
      return rows as ExamRoom[];
    } catch (error) {
      console.error("Repo Error (Room FindByCampaign):", error);
      throw error;
    }
  }

  // Insert หรือ Update ห้องสอบ (ต่อ campaign)
  async upsert(data: ExamRoom, connection: PoolConnection): Promise<any> {
    const sql = `
      INSERT INTO exam_rooms (campaign_id, room_code, capacity)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE capacity = VALUES(capacity);
    `;
    try {
      const [result] = await connection.execute(sql, [
        data.campaign_id,
        data.room_code,
        data.capacity,
      ]);
      return result;
    } catch (error) {
      console.error("Repo Error (Room Upsert):", error);
      throw error;
    }
  }

  // ลบห้องสอบของ campaign นั้น ๆ
  async delete(
    campaignId: number,
    roomCode: string,
    connection: PoolConnection
  ): Promise<any> {
    const sql =
      "DELETE FROM exam_rooms WHERE campaign_id = ? AND room_code = ?;";
    try {
      const [result] = await connection.execute(sql, [campaignId, roomCode]);
      return result;
    } catch (error) {
      console.error("Repo Error (Room Delete):", error);
      throw error;
    }
  }
}

const examRoomRepo = new ExamRoomRepo();
export default examRoomRepo;
