"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const grading_score_log_controller_1 = require("../Controller/grading_score_log.controller");
const gradingScoreLogRouter = (0, express_1.Router)();
gradingScoreLogRouter.get("/gradingscorelog/:bagId", grading_score_log_controller_1.gradingScoreLogController.getScoreLogByBagId);
exports.default = gradingScoreLogRouter;
