// routes/dashboard.route.ts
import { Router } from "express";
import { DashboardController } from "../Controller/dashboard.controller";

const router = Router();

router.get("/dashboard/campaign/:campaignId", DashboardController.getCampaignDashboard);

export default router;
