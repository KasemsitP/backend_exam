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
exports.seatController = void 0;
const seat_service_1 = require("../Service/seat.service");
class seatController {
}
exports.seatController = seatController;
_a = seatController;
seatController.getSeat = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { campaign_id, roomCode } = req.params;
    console.log(campaign_id, roomCode);
    if (!campaign_id || !roomCode) {
        return res
            .status(400)
            .json({ message: "Invalid campaign_id, roomCode " });
    }
    try {
        const data = yield seat_service_1.seatService.getSeatUser(Number(campaign_id), String(roomCode));
        console.log("gulnwza", data);
        return res.status(200).json(data);
    }
    catch (error) {
        console.error("getSeat error", error);
        return res.status(500).json({ message: "getSeat Error" });
    }
});
seatController.ArrangeMent = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // const { campaign_id, roomCode } = req.body;
    // if (!campaign_id || !roomCode) {
    //     return res.status(400).send({ message: "Invalid Campaign ID and RoomCode" });
    // }
    const { campaign_id, roomCode } = req.params;
    const { seatsPerRow } = req.query;
    //  console.log(campaign_id , roomCode, seatsPerRow)
    // console.log(campaign_id , roomCode , seatsPerRow)
    if (!campaign_id || !roomCode) {
        return res.status(400).json({ message: "Invalid Campaign ID or RoomCode" });
    }
    try {
        const rows = yield seat_service_1.seatService.ArrangeSeat(Number(campaign_id), String(roomCode), Number(seatsPerRow));
        const NumberSeatper = 5;
        const assignments = rows.flatMap((row, rowIndex) => row.map((user, colIndex) => ({
            rowIndex,
            colIndex,
            user_id: user.id,
            user_code: user.user_code,
            full_name: user.full_name,
            last_name: user.last_name
        })));
        return res.status(200).json({
            campaignId: campaign_id,
            roomCode,
            seatsPerRow: NumberSeatper,
            seats: assignments
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).send({ message: "Error arranging seats" });
    }
});
seatController.CreateSeat = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { campaign_id, roomCode } = req.params;
    const { seatsPerRow } = req.body;
    console.log("CreateSeat:", campaign_id, roomCode, seatsPerRow);
    if (!campaign_id || !roomCode || !seatsPerRow) {
        return res
            .status(400)
            .json({ message: "Invalid campaign_id, roomCode or seatsPerRow" });
    }
    try {
        const result = yield seat_service_1.seatService.ArrangeSeatAndCommit(Number(campaign_id), String(roomCode), Number(seatsPerRow));
        return res.status(200).json({
            message: "จัดที่นั่งและบันทึกเรียบร้อย",
            seatsPerRow: result.seatsPerRow,
            totalSeats: result.seats.length,
            seats: result.seats,
        });
    }
    catch (error) {
        console.error("CreateSeat error:", error);
        return res.status(500).json({ message: "Error arranging seats" });
    }
});
seatController.IsAssigned = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { campaign_id } = req.params;
    if (!campaign_id) {
        return res.status(400).json({ message: "Invalid Campaign ID" });
    }
    const result = yield seat_service_1.seatService.IsAssigned(Number(campaign_id));
    return res.status(200).json(result);
});
seatController.ResetSeat = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { campaign_id } = req.params;
    if (!campaign_id) {
        return res.status(400).json({ message: "Invalid Campaign ID" });
    }
    const result = yield seat_service_1.seatService.ResetSeat(Number(campaign_id));
    return res.status(200).json({
        "message": "Reset Completed"
    });
});
seatController.getUserCount = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { campaign_id } = req.params;
    if (!campaign_id) {
        return res.status(400).json({ message: "Invalid Campaign ID" });
    }
    const result = yield seat_service_1.seatService.GetStatusUserCount(Number(campaign_id));
    return res.status(200).json(result);
});
