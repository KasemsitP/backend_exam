"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// routes/dashboard.route.ts
const express_1 = require("express");
const dashboard_controller_1 = require("../Controller/dashboard.controller");
const router = (0, express_1.Router)();
router.get("/dashboard/campaign/:campaignId", dashboard_controller_1.DashboardController.getCampaignDashboard);
exports.default = router;
