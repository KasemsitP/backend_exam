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
const examroom_service_1 = require("../Service/examroom.service");
class examRoomController {
}
exports.examRoomController = examRoomController;
_a = examRoomController;
// GET /api/exam-rooms/campaign/:campaignId
examRoomController.getAllByCampaign = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { campaignId } = req.params;
        const rooms = yield examroom_service_1.examRoomService.getAllByCampaign(campaignId);
        res.status(200).json(rooms);
    }
    catch (error) {
        res.status(500).send({ message: error.message });
    }
});
// POST /api/exam-rooms
examRoomController.save = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { campaign_id, roomCode, capacity } = req.body;
        const payload = {
            campaignId: Number(campaign_id),
            roomCode,
            capacity,
        };
        console.log(payload);
        if (!payload.campaignId || !payload.roomCode || !payload.capacity) {
            return res
                .status(400)
                .send({ message: "Missing required fields (campaignId, roomCode, capacity)" });
        }
        console.log("asdasd");
        const result = yield examroom_service_1.examRoomService.saveRoom(payload);
        res.status(201).json(result);
    }
    catch (error) {
        res.status(500).send({ message: error.message });
    }
});
// DELETE /api/exam-rooms/:campaignId/:roomCode
examRoomController.delete = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { campaignId, roomCode } = req.params;
        if (!campaignId || !roomCode) {
            return res
                .status(400)
                .send({ message: "Missing campaignId or roomCode" });
        }
        const result = yield examroom_service_1.examRoomService.deleteRoom(campaignId, roomCode);
        res.status(200).json(result);
    }
    catch (error) {
        res.status(500).send({ message: error.message });
    }
});
