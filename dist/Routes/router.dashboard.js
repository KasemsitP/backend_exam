"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// routes/dashboard.route.ts
const express_1 = require("express");
const dashboard_controller_1 = require("../Controller/dashboard.controller");
const router = (0, express_1.Router)();
router.get("/dashboard/campaign/:campaignId", dashboard_controller_1.DashboardController.getCampaignDashboard);
router.get("/dashboard/campaign/:campaignId/charts", dashboard_controller_1.DashboardController.getCampaignChart);
router.get("/dashboard/campaign/:campaignId/slot-coverage", dashboard_controller_1.DashboardController.getCampaignSlotCoverage);
exports.default = router;
