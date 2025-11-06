"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const examRoom_controller_1 = require("../Controller/examRoom.controller");
const examRoomRouter = (0, express_1.Router)();
examRoomRouter.get("/exam-rooms/session/:sessionId", examRoom_controller_1.examRoomController.getAllBySession);
examRoomRouter.post("/exam-rooms/", examRoom_controller_1.examRoomController.save);
examRoomRouter.delete("/exam-rooms/:sessionId/:roomCode", examRoom_controller_1.examRoomController.delete);
exports.default = examRoomRouter;
