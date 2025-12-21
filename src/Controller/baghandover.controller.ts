// src/Controller/baghandover.controller.ts
import { Request, Response } from "express";
import { BagHandoverService } from "../Service/baghandover.service";

export class BagHandoverController {
  /**
   * GET /api/bag-handover/:campaignId
   * ตัวอย่าง: /api/bag-handover/camp-1
   */
  static async getForCampaign(req: Request, res: Response) {
    try {
      const { campaignId } = req.params;
      if (!campaignId) {
        return res.status(400).json({ message: "Missing campaignId" });
      }

      const result = await BagHandoverService.getForCampaign(campaignId);
      res.json(result);
    } catch (err: any) {
      console.error("Controller Error (BagHandover getForCampaign):", err);
      res.status(500).json({ message: err.message ?? "Internal server error" });
    }
  }

  /**
   * POST /api/bag-handover/check-in
   * body:
   * {
   *   campaignId: "camp-1",
   *   sessionId: 10,
   *   bagNo: 3,
   *   graderId: 5,
   *   operatorId: 1,
   *   note?: "..."
   * }
   */
  static async checkIn(req: Request, res: Response) {
    try {
      const {
        campaignId,
        bagId,        // 👈 เปลี่ยนจาก bagNo → bagId
        graderId,
        operatorId,
        note,
      } = req.body ?? {};

      if (!campaignId || !bagId || !graderId || !operatorId) {
        return res
          .status(400)
          .json({ message: "Missing required fields for check-in" });
      }

      await BagHandoverService.checkIn({
        campaignId,
        bagId: Number(bagId),
        graderId: Number(graderId),
        operatorId: Number(operatorId),
        note,
      });

      res.status(201).json({ message: "Bag check-in recorded" });
    } catch (err: any) {
      console.error("Controller Error (BagHandover checkIn):", err);
      res.status(500).json({ message: err.message ?? "Internal server error" });
    }
  }

  static async checkOut(req: Request, res: Response) {
    console.log(req.body)
    try {
      const { campaignId, bagNo, operatorId, note ,sessionId} = req.body ?? {};

      if (!campaignId || !bagNo || !operatorId || !sessionId) {
        return res
          .status(400)
          .json({ message: "Missing required fields for check-out" });
      }
      console.log(bagNo , campaignId , operatorId, sessionId)

await BagHandoverService.checkOut({
      campaignId,
      sessionId: Number(sessionId), 
      bagNo: Number(bagNo),         
      operatorId: Number(operatorId),
      note,
    });

      res.status(201).json({ message: "Bag check-out recorded" });
    } catch (err: any) {
      console.error("Controller Error (BagHandover checkOut):", err);
      res.status(500).json({ message: err.message ?? "Internal server error" });
    }
  }
}
