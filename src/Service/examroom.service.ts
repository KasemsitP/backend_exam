import { DB } from "../model/DB";
import examRoomRepo from "../Repo/examRoom.repo"; // (ไฟล์ใหม่)
import { ExamRoom } from "../Repo/examRoom.repo"; // (Import Interface)

// (Interface นี้คือที่ Service จะส่งกลับไปหา Frontend)
interface FrontendExamRoom {
  sessionId: string; // (e.g., "sess-10")
  roomCode: string;
  capacity: number;
}

// (Helper)
const toFrontendRoom = (dbRoom: ExamRoom): FrontendExamRoom => {
  return {
    sessionId: `sess-${dbRoom.session_id}`,
    roomCode: dbRoom.room_code,
    capacity: dbRoom.capacity,
  };
};

export class examRoomService {

  static getAllBySession = async (sessionIdStr: string) => {
    const connection = await DB.getInstance().getConnection();
    try {
      const sessionId = parseInt(sessionIdStr.replace("sess-", ""));
      if (isNaN(sessionId)) throw new Error("Invalid Session ID format");

      const dbRooms = await examRoomRepo.findBySessionId(sessionId, connection);
      
      // (แปลง DB -> Frontend)
      return dbRooms.map(toFrontendRoom);
      
    } catch (error) {
      console.error("Service Error (Get Rooms):", error);
      throw error;
    } finally {
      connection.release();
    }
  };

  static saveRoom = async (payload: { sessionId: string; roomCode: string; capacity: number }) => {
    const connection = await DB.getInstance().getConnection();
    try {
      const sessionId = parseInt(payload.sessionId.replace("sess-", ""));
      if (isNaN(sessionId)) throw new Error("Invalid Session ID format");
    
      const roomData: ExamRoom = {
        session_id: sessionId,
        room_code: payload.roomCode,
        capacity: payload.capacity,
      };
      
      // (ใช้ Upsert)
      await examRoomRepo.upsert(roomData, connection);
      
      // (ส่งข้อมูลที่บันทึกแล้วกลับไป)
      return toFrontendRoom({
        ...roomData
      });
    
    } catch (error) {
      console.error("Service Error (Save Room):", error);
      throw error;
    } finally {
      connection.release();
    }
  };
  
  static deleteRoom = async (sessionIdStr: string, roomCode: string) => {
    const connection = await DB.getInstance().getConnection();
    try {
      const sessionId = parseInt(sessionIdStr.replace("sess-", ""));
      if (isNaN(sessionId)) throw new Error("Invalid Session ID format");

      await examRoomRepo.delete(sessionId, roomCode, connection);
      
      return { sessionId: sessionIdStr, roomCode: roomCode };
    
    } catch (error) {
      console.error("Service Error (Delete Room):", error);
      throw error;
    } finally {
      connection.release();
    }
  };
}