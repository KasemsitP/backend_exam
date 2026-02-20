
import { Request, Response } from "express";
import { DashboardService } from "../Service/dashboard.service";

export class DashboardController {
  static async getCampaignDashboard(req: Request, res: Response) {
    const campaignId = Number(req.params.campaignId);
    console.log("Received request for campaignId:", campaignId);
    if (isNaN(campaignId)) {
      return res.status(400).json({ message: "invalid campaign id" });
    }

    try {
      const data = await DashboardService.getCampaignDashboard(campaignId);
      res.json(data);
    } catch (err) {
      console.error("getCampaignDashboard error:", err);
      res.status(500).json({ message: "โหลด dashboard ไม่สำเร็จ" });
    }
  }
}
