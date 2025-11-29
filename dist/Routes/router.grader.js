"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const grader_controller_1 = require("../Controller/grader.controller");
const graderRouter = (0, express_1.Router)();
graderRouter.get("/graders/campaign/:campaignId", grader_controller_1.graderController.getByCampaignId);
exports.default = graderRouter;
