import { Router } from "express";
import { examRoomController } from "../Controller/examRoom.controller";

const examRoomRouter = Router();

examRoomRouter.get("/exam-rooms/session/:sessionId", examRoomController.getAllBySession);
examRoomRouter.post("/exam-rooms/", examRoomController.save);
examRoomRouter.delete("/exam-rooms/:sessionId/:roomCode", examRoomController.delete);

export default examRoomRouter;