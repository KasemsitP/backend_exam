// src/Service/examRoom.service.ts
import { DB } from "../model/DB";
import examRoomRepo, { ExamRoom } from "../Repo/examroom.repo";

interface FrontendExamRoom {
  campaignId: number;
  roomCode: string;
  capacity: number;
}

const toFrontendRoom = (dbRoom: ExamRoom): FrontendExamRoom => {
  return {
    campaignId: dbRoom.campaign_id,
    roomCode: dbRoom.room_code,
    capacity: dbRoom.capacity,
  };
};

export class examRoomService {
  // ดึงห้องสอบตาม campaign
  static getAllByCampaign = async (campaignIdStr: string) => {
    const connection = await DB.getInstance().getConnection();
    try {
      const campaignId = Number(campaignIdStr);
      if (isNaN(campaignId)) throw new Error("Invalid Campaign ID format");

      const dbRooms = await examRoomRepo.findByCampaignId(
        campaignId,
        connection
      );
      return dbRooms.map(toFrontendRoom);
    } catch (error) {
      console.error("Service Error (Get Rooms By Campaign):", error);
      throw error;
    } finally {
      connection.release();
    }
  };

  // บันทึก/แก้ไขห้องสอบสำหรับ campaign
  static saveRoom = async (payload: {
    campaignId: number;
    roomCode: string;
    capacity: number;
  }) => {
    const connection = await DB.getInstance().getConnection();
    try {
      const campaignId = Number(payload.campaignId);
      if (isNaN(campaignId)) throw new Error("Invalid Campaign ID");

      const roomData: ExamRoom = {
        campaign_id: campaignId,
        room_code: payload.roomCode,
        capacity: payload.capacity,
      };

      const is_duplicate = await examRoomRepo.IsDubpliateCode(
        campaignId,
        payload.roomCode,
        connection
      );
      if (is_duplicate) {
        throw new Error("ไม่สามารถสร้างห้องสอบชื่อซ้ำกันได้ กรุณาเปลี่ยนชื่อห้องสอบ");
      }


      await examRoomRepo.upsert(roomData, connection);

      // ส่งกลับเป็นรูป frontend
      return toFrontendRoom(roomData);
    } catch (error) {
      console.error("Service Error (Save Room):", error);
      throw error;
    } finally {
      connection.release();
    }
  };

  // ลบห้องสอบใน campaign
  static deleteRoom = async (campaignIdStr: string, roomCode: string) => {
    const connection = await DB.getInstance().getConnection();
    try {
      const campaignId = Number(campaignIdStr);
      if (isNaN(campaignId)) throw new Error("Invalid Campaign ID");

      const isAssigned = await examRoomRepo.isAssigned(campaignId, roomCode, connection);
      if (isAssigned) {
        throw new Error("ไม่สามารถลบห้องสอบนี้ได้ เนื่องจากมีผู้สอบที่ถูกกำหนดให้สอบในห้องนี้แล้ว กรุณารีเซ็ตห้องสอบก่อนลบ");
      }

      await examRoomRepo.delete(campaignId, roomCode, connection);

      return { campaignId: campaignIdStr, roomCode };
    } catch (error) {
      console.error("Service Error (Delete Room):", error);
      throw error;
    } finally {
      connection.release();
    }
  };
}
