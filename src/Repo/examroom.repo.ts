// src/Repo/examRoom.repo.ts

import { DB } from "../model/DB";
import { PoolConnection, RowDataPacket, Pool } from "mysql2/promise";


export interface ExamRoom {
  campaign_id: number;
  room_code: string;
  capacity: number;
}

class ExamRoomRepo {
  private pool: Pool
  constructor() {
    this.pool = DB.getInstance();
  }

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

  async findByCampaignIdCon(
    campaignId: number,
  ): Promise<ExamRoom[]> {
    const sql =
      "SELECT campaign_id, room_code, capacity FROM exam_rooms WHERE campaign_id = ? ORDER BY room_code ASC;";
    try {
      const [rows] = await this.pool.execute<RowDataPacket[]>(sql, [
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

  async IsDubpliateCode(campaign_id: number, room_code: string, connection: Pool | PoolConnection = this.pool): Promise<any> {
    const sql = `
    select 1 from exam_rooms where campaign_id = ? and room_code = ? limit 1;
    `;
    const [rows] = await connection.execute<RowDataPacket[]>(sql, [
      campaign_id,
      room_code,
    ]);
    return rows.length > 0; // true if duplicate exists

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
  async isAssigned(
    campaignId: number,
    roomCode: string,
    connection: PoolConnection
  ): Promise<boolean> {

    const sql = `
    SELECT COUNT(us.id) AS countnum
    FROM user_campaigns us
    WHERE us.room_code = ?
      AND us.campaign_id = ?
  `;

    try {
      const [rows] = await connection.execute<RowDataPacket[]>(
        sql,
        [roomCode, campaignId]
      );

      return rows[0].countnum > 0;
    } catch (error) {
      console.error("assigned already", error);
      throw error;
    }
  }
}




const examRoomRepo = new ExamRoomRepo();
export default examRoomRepo;
