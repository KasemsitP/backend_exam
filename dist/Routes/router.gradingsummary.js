"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const grading_summary_controller_1 = require("../Controller/grading-summary.controller");
const gradingSummaryRouter = (0, express_1.Router)();
gradingSummaryRouter.get("/grading-summary/check", grading_summary_controller_1.GradingSummaryController.checkGraderHistory);
gradingSummaryRouter.get("/grading-summary/bag-progress/:bagId", grading_summary_controller_1.GradingSummaryController.getBagProgress);
exports.default = gradingSummaryRouter;
