"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const campaign_controller_1 = require("../Controller/campaign.controller");
const campaignRouter = (0, express_1.Router)();
campaignRouter.post("/campaigns", campaign_controller_1.campaignController.create);
campaignRouter.delete("/campaigns/:id", campaign_controller_1.campaignController.delete);
campaignRouter.put("/campaigns", campaign_controller_1.campaignController.update);
exports.default = campaignRouter;
