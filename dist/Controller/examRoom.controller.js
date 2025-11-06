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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.examRoomController = void 0;
const examRoom_service_1 = require("../Service/examRoom.service");
class examRoomController {
}
exports.examRoomController = examRoomController;
_a = examRoomController;
examRoomController.getAllBySession = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { sessionId } = req.params; // (Frontend ID: "sess-10")
        const rooms = yield examRoom_service_1.examRoomService.getAllBySession(sessionId);
        res.status(200).json(rooms);
    }
    catch (error) {
        res.status(500).send({ message: error.message });
    }
});
examRoomController.save = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const payload = req.body;
        if (!payload.sessionId || !payload.roomCode || !payload.capacity) {
            return res.status(400).send({ message: "Missing required fields" });
        }
        const result = yield examRoom_service_1.examRoomService.saveRoom(payload);
        res.status(201).json(result);
    }
    catch (error) {
        res.status(500).send({ message: error.message });
    }
});
examRoomController.delete = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { sessionId, roomCode } = req.params;
        if (!sessionId || !roomCode) {
            return res.status(400).send({ message: "Missing sessionId or roomCode" });
        }
        const result = yield examRoom_service_1.examRoomService.deleteRoom(sessionId, roomCode);
        res.status(200).json(result);
    }
    catch (error) {
        res.status(500).send({ message: error.message });
    }
});
