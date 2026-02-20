"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/Routes/router.examRoom.ts
const express_1 = require("express");
const examroom_controller_1 = require("../Controller/examroom.controller");
const examRoomRouter = (0, express_1.Router)();
examRoomRouter.get("/exam-rooms/campaign/:campaignId", examroom_controller_1.examRoomController.getAllByCampaign);
examRoomRouter.post("/exam-rooms", examroom_controller_1.examRoomController.save);
examRoomRouter.delete("/exam-rooms/:campaignId/:roomCode", examroom_controller_1.examRoomController.delete);
exports.default = examRoomRouter;
