// src/Controller/grader.controller.ts
import { Request, Response } from "express";
import { graderService } from "../Service/grader.service";

export class graderController {
  static getByCampaignId = async (req: Request, res: Response) => {
    try {
      const raw = req.params.campaignId;
      if (!raw) {
        return res
          .status(400)
          .send({ message: "Missing campaignId parameter" });
      }

      const campaignIdNumeric = Number(raw);
      if (Number.isNaN(campaignIdNumeric) || campaignIdNumeric <= 0) {
        return res
          .status(400)
          .send({ message: "campaignId must be a positive number" });
      }

      // ✅ ตอนนี้จะได้ array ของ ApiGrader ที่มี question_no
      const graders = await graderService.getAllByCampaignId(
        campaignIdNumeric
      );
      return res.status(200).json(graders);
    } catch (error: any) {
      console.error("Controller Error (graderController.getByCampaignId):", error);
      return res
        .status(500)
        .send({ message: error.message ?? "Server error" });
    }
  };

  static getAssignmentByAccountId = async (req: Request, res: Response) => {
    try {
      const { campaign_id, account_id } = req.params
      console.log(campaign_id , account_id)
      if (!campaign_id || !account_id) {
        return res
          .status(400).send({ message: "Missing campaignId parameter" });
      }
      const result = await graderService.getAssignmentByAccountId(Number(campaign_id) , Number(account_id))
       return res.status(200).json(result);

    } catch (error: any) {
      return res
        .status(500)
        .send({ message: error.message ?? "Server error" });
    }
  }

  // create/update/delete เหมือนเดิม
}
