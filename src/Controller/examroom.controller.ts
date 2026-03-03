// src/Controller/examRoom.controller.ts
import { Request, Response } from "express";
import { examRoomService } from "../Service/examroom.service";

export class examRoomController {
    // GET /api/exam-rooms/campaign/:campaignId
    static getAllByCampaign = async (req: Request, res: Response) => {
        try {
            const { campaignId } = req.params;
            const rooms = await examRoomService.getAllByCampaign(campaignId);
            res.status(200).json(rooms);
        } catch (error: any) {
            res.status(500).send({ message: error.message });
        }
    };

    // POST /api/exam-rooms
    static save = async (req: Request, res: Response) => {
        try {
            const { campaign_id, roomCode, capacity } = req.body;

            const payload = {
                campaignId: Number(campaign_id),
                roomCode,
                capacity,
            };

            console.log(payload)

            if (!payload.campaignId || !payload.roomCode || !payload.capacity) {
                return res
                    .status(400)
                    .send({ message: "Missing required fields (campaignId, roomCode, capacity)" });
            }
            console.log("asdasd")

            const result = await examRoomService.saveRoom(payload);
            res.status(201).json(result);
        } catch (error: any) {
            res.status(500).send({ message: error.message });
        }
    };

    // DELETE /api/exam-rooms/:campaignId/:roomCode
    static delete = async (req: Request, res: Response) => {
        try {
            const { campaignId, roomCode } = req.params;
            if (!campaignId || !roomCode) {
                return res
                    .status(400)
                    .send({ message: "Missing campaignId or roomCode" });
            }

            const result = await examRoomService.deleteRoom(campaignId, roomCode);
            res.status(200).json(result);
        } catch (error: any) {
            res.status(500).send({ message: error.message });
        }
    };

    static updateRoom = async (req: Request, res: Response) => {
        try {
            const { campaign_id, roomCode } = req.params;
            const { capacity } = req.body;
            if (!campaign_id || !roomCode || !capacity) {
                return res.status(400).json({ message: "Invalid campaign_id, roomCode or capacity" });
            }
            await examRoomService.UpdateRoom(Number(campaign_id), String(roomCode), Number(capacity));
            return res.status(200).json({ message: "Seat updated successfully" , success: true });

        } catch (error: any) {
            console.error("updateSeat error:", error);
            return res.status(500).json({ message: error.message, success: false });
        }
    }
}
