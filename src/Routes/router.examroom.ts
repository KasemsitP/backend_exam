// src/Routes/router.examRoom.ts
import { Router } from "express";
import { examRoomController } from "../Controller/examroom.controller";

const examRoomRouter = Router();


examRoomRouter.get(
    "/exam-rooms/campaign/:campaignId",
    examRoomController.getAllByCampaign
);
examRoomRouter.post("/exam-rooms", examRoomController.save);
examRoomRouter.delete(
    "/exam-rooms/:campaignId/:roomCode",
    examRoomController.delete
);

export default examRoomRouter;
