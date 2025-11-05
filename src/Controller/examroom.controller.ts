import { Request, Response } from "express";
import { examRoomService } from "../Service/examRoom.service";

export class examRoomController {

  static getAllBySession = async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params; // (Frontend ID: "sess-10")
      const rooms = await examRoomService.getAllBySession(sessionId);
      res.status(200).json(rooms);
    } catch (error: any) {
      res.status(500).send({ message: error.message });
    }
  };
  
  static save = async (req: Request, res: Response) => {
    try {
      const payload = req.body;
      if (!payload.sessionId || !payload.roomCode || !payload.capacity) {
        return res.status(400).send({ message: "Missing required fields" });
      }
      const result = await examRoomService.saveRoom(payload);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(500).send({ message: error.message });
   }
  };
  
  static delete = async (req: Request, res: Response) => {
    try {
      const { sessionId, roomCode } = req.params;
      if (!sessionId || !roomCode) {
        return res.status(400).send({ message: "Missing sessionId or roomCode" });
      }
      const result = await examRoomService.deleteRoom(sessionId, roomCode);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(500).send({ message: error.message });
    }
  };
}