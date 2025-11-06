"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const exam_controller_1 = require("../Controller/exam.controller");
const examDataRouter = (0, express_1.Router)();
examDataRouter.get("/exam-data", exam_controller_1.examDataController.getInitialData);
exports.default = examDataRouter;
