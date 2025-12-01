"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.examRoomService = void 0;
const DB_1 = require("../model/DB");
const examRoom_repo_1 = __importDefault(require("../Repo/examRoom.repo")); // (ไฟล์ใหม่)
// (Helper)
const toFrontendRoom = (dbRoom) => {
    return {
        sessionId: `sess-${dbRoom.session_id}`,
        roomCode: dbRoom.room_code,
        capacity: dbRoom.capacity,
    };
};
class examRoomService {
}
exports.examRoomService = examRoomService;
_a = examRoomService;
examRoomService.getAllBySession = (sessionIdStr) => __awaiter(void 0, void 0, void 0, function* () {
    const connection = yield DB_1.DB.getInstance().getConnection();
    try {
        const sessionId = parseInt(sessionIdStr.replace("sess-", ""));
        if (isNaN(sessionId))
            throw new Error("Invalid Session ID format");
        const dbRooms = yield examRoom_repo_1.default.findBySessionId(sessionId, connection);
        return dbRooms.map(toFrontendRoom);
    }
    catch (error) {
        console.error("Service Error (Get Rooms):", error);
        throw error;
    }
    finally {
        connection.release();
    }
});
examRoomService.saveRoom = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const connection = yield DB_1.DB.getInstance().getConnection();
    try {
        const sessionId = parseInt(payload.sessionId.replace("sess-", ""));
        if (isNaN(sessionId))
            throw new Error("Invalid Session ID format");
        const roomData = {
            session_id: sessionId,
            room_code: payload.roomCode,
            capacity: payload.capacity,
        };
        // (ใช้ Upsert)
        yield examRoom_repo_1.default.upsert(roomData, connection);
        // (ส่งข้อมูลที่บันทึกแล้วกลับไป)
        return toFrontendRoom(Object.assign({}, roomData));
    }
    catch (error) {
        console.error("Service Error (Save Room):", error);
        throw error;
    }
    finally {
        connection.release();
    }
});
examRoomService.deleteRoom = (sessionIdStr, roomCode) => __awaiter(void 0, void 0, void 0, function* () {
    const connection = yield DB_1.DB.getInstance().getConnection();
    try {
        const sessionId = parseInt(sessionIdStr.replace("sess-", ""));
        if (isNaN(sessionId))
            throw new Error("Invalid Session ID format");
        yield examRoom_repo_1.default.delete(sessionId, roomCode, connection);
        return { sessionId: sessionIdStr, roomCode: roomCode };
    }
    catch (error) {
        console.error("Service Error (Delete Room):", error);
        throw error;
    }
    finally {
        connection.release();
    }
});
