"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/Routes/router.examRoom.ts
const express_1 = require("express");
const examRoom_controller_1 = require("../Controller/examRoom.controller");
const examRoomRouter = (0, express_1.Router)();
examRoomRouter.get("/exam-rooms/campaign/:campaignId", examRoom_controller_1.examRoomController.getAllByCampaign);
examRoomRouter.post("/exam-rooms", examRoom_controller_1.examRoomController.save);
examRoomRouter.delete("/exam-rooms/:campaignId/:roomCode", examRoom_controller_1.examRoomController.delete);
exports.default = examRoomRouter;
