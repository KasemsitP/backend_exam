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
// src/Service/examRoom.service.ts
const DB_1 = require("../model/DB");
const examRoom_repo_1 = __importDefault(require("../Repo/examRoom.repo"));
const toFrontendRoom = (dbRoom) => {
    return {
        campaignId: dbRoom.campaign_id,
        roomCode: dbRoom.room_code,
        capacity: dbRoom.capacity,
    };
};
class examRoomService {
}
exports.examRoomService = examRoomService;
_a = examRoomService;
// ดึงห้องสอบตาม campaign
examRoomService.getAllByCampaign = (campaignIdStr) => __awaiter(void 0, void 0, void 0, function* () {
    const connection = yield DB_1.DB.getInstance().getConnection();
    try {
        const campaignId = Number(campaignIdStr);
        if (isNaN(campaignId))
            throw new Error("Invalid Campaign ID format");
        const dbRooms = yield examRoom_repo_1.default.findByCampaignId(campaignId, connection);
        return dbRooms.map(toFrontendRoom);
    }
    catch (error) {
        console.error("Service Error (Get Rooms By Campaign):", error);
        throw error;
    }
    finally {
        connection.release();
    }
});
// บันทึก/แก้ไขห้องสอบสำหรับ campaign
examRoomService.saveRoom = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const connection = yield DB_1.DB.getInstance().getConnection();
    try {
        const campaignId = Number(payload.campaignId);
        if (isNaN(campaignId))
            throw new Error("Invalid Campaign ID");
        const roomData = {
            campaign_id: campaignId,
            room_code: payload.roomCode,
            capacity: payload.capacity,
        };
        yield examRoom_repo_1.default.upsert(roomData, connection);
        // ส่งกลับเป็นรูป frontend
        return toFrontendRoom(roomData);
    }
    catch (error) {
        console.error("Service Error (Save Room):", error);
        throw error;
    }
    finally {
        connection.release();
    }
});
// ลบห้องสอบใน campaign
examRoomService.deleteRoom = (campaignIdStr, roomCode) => __awaiter(void 0, void 0, void 0, function* () {
    const connection = yield DB_1.DB.getInstance().getConnection();
    try {
        const campaignId = Number(campaignIdStr);
        if (isNaN(campaignId))
            throw new Error("Invalid Campaign ID");
        yield examRoom_repo_1.default.delete(campaignId, roomCode, connection);
        return { campaignId: campaignIdStr, roomCode };
    }
    catch (error) {
        console.error("Service Error (Delete Room):", error);
        throw error;
    }
    finally {
        connection.release();
    }
});
