import { Request, Response } from "express";
import { seatService } from "../Service/seat.service";


export class seatController {



    static getSeat = async (req: Request, res: Response) => {
        const { campaign_id, roomCode } = req.params;
        console.log(campaign_id, roomCode)


        if (!campaign_id || !roomCode) {
            return res
                .status(400)
                .json({ message: "Invalid campaign_id, roomCode " });
        }

        try {
            const data = await seatService.getSeatUser(
                Number(campaign_id),
                String(roomCode)
            )
            console.log("gulnwza", data)
            return res.status(200).json(data);
        } catch (error) {
            console.error("getSeat error", error);
            return res.status(500).json({ message: "getSeat Error" });
        }
    };


    static ArrangeMent = async (req: Request, res: Response) => {
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
            const rows = await seatService.ArrangeSeat(Number(campaign_id), String(roomCode), Number(seatsPerRow));

            const NumberSeatper = 5;

            const assignments = rows.flatMap((row, rowIndex) =>
                row.map((user, colIndex) => ({
                    rowIndex,
                    colIndex,
                    user_id: user.id,
                    user_code: user.user_code,
                    full_name: user.full_name,
                    last_name: user.last_name
                }))
            );

            return res.status(200).json({
                campaignId: campaign_id,
                roomCode,
                seatsPerRow: NumberSeatper,
                seats: assignments
            });

        } catch (error) {
            console.error(error);
            return res.status(500).send({ message: "Error arranging seats" });
        }
    }

    static CreateSeat = async (req: Request, res: Response) => {
        const { campaign_id, roomCode } = req.params;
        const { seatsPerRow } = req.body;

        console.log("CreateSeat:", campaign_id, roomCode, seatsPerRow);

        if (!campaign_id || !roomCode || !seatsPerRow) {
            return res
                .status(400)
                .json({ message: "Invalid campaign_id, roomCode or seatsPerRow" });
        }

        try {
            const result = await seatService.ArrangeSeatAndCommit(
                Number(campaign_id),
                String(roomCode),
                Number(seatsPerRow)
            );

            return res.status(200).json({
                message: "จัดที่นั่งและบันทึกเรียบร้อย",
                seatsPerRow: result.seatsPerRow,
                totalSeats: result.seats.length,
                seats: result.seats,
            });
        } catch (error) {
            console.error("CreateSeat error:", error);
            return res.status(500).json({ message: "Error arranging seats" });
        }
    }
    static IsAssigned = async (req: Request, res: Response) => {
        const { campaign_id } = req.params
        if (!campaign_id) {
            return res.status(400).json({ message: "Invalid Campaign ID" });
        }
        const result = await seatService.IsAssigned(Number(campaign_id))

        return res.status(200).json(result)
    }
    static ResetSeat = async (req: Request, res: Response) => {
        const { campaign_id } = req.params
        if (!campaign_id) {
            return res.status(400).json({ message: "Invalid Campaign ID" });
        }
        const result = await seatService.ResetSeat(Number(campaign_id))

        return res.status(200).json({
            "message": "Reset Completed"
        })
    }
    static getUserCount = async (req: Request, res: Response) => {
        const { campaign_id } = req.params
        if (!campaign_id) {
            return res.status(400).json({ message: "Invalid Campaign ID" });
        }
        const result = await seatService.GetStatusUserCount(Number(campaign_id))

        return res.status(200).json(result)
    }
}