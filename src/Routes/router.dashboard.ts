// routes/dashboard.route.ts
import { Router } from "express";
import { DashboardController } from "../Controller/dashboard.controller";

const router = Router();

router.get("/dashboard/campaign/:campaignId", DashboardController.getCampaignDashboard);
router.get("/dashboard/campaign/:campaignId/charts", DashboardController.getCampaignChart);
router.get("/dashboard/campaign/:campaignId/slot-coverage", DashboardController.getCampaignSlotCoverage);

export default router;
