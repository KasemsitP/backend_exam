// src/Controller/grader.controller.ts
import { Request, Response } from "express";
import { graderService } from "../Service/grader.service";
import { GraderBagReportService } from "../Service/graderbag-report.service";

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
static getConfirmedBags = async (req: Request, res: Response) => {
  try {
    const campaignId = Number(req.params.campaignId);
    const graderId = Number(req.params.graderId);

    if (!campaignId || !graderId) {
      return res.status(400).json({ message: "ข้อมูลไม่ถูกต้อง" });
    }

    const rows = await graderService.getBagFinished(
      campaignId,
      graderId
    );

    return res.status(200).json(rows);
  } catch (error: any) {
    return res.status(500).json({
      message: error.message || "โหลดข้อมูลไม่สำเร็จ",
    });
  }
}
  static async printBagManualPayloadPdf(req: Request, res: Response) {
    try {
      const bagId = Number(req.params.bagId);
      const graderId = Number(req.params.graderId);

      if (!bagId || !graderId) {
        return res.status(400).json({
          message: "bagId หรือ graderId ไม่ถูกต้อง",
        });
      }

      const pdfBuffer = await GraderBagReportService.generateBagManualPayloadPdf(bagId, graderId);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="bag_${bagId}_grader_${graderId}_manual.pdf"`
      );

      return res.send(pdfBuffer);
    } catch (error: any) {
      return res.status(500).json({
        message: error.message || "ไม่สามารถสร้างรายงาน PDF ได้",
      });
    }
  }

  static async printBagScorePayloadPdf(req: Request, res: Response) {
    try {
      const bagId = Number(req.params.bagId);
      const questionNo = Number(req.params.questionNo);
      const graderId = Number(req.params.graderId);

      console.log("HIT printBagScorePayloadPdf", { bagId, questionNo, graderId });
      if (!bagId || !questionNo || !graderId) {
        return res.status(400).json({
          message: "bagId หรือ questionNo หรือ graderId ไม่ถูกต้อง",
        });
      }

      const pdfBuffer = await GraderBagReportService.generateBagScorePayloadPdf(bagId, questionNo,graderId);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="bag_${bagId}_question_${questionNo}_score_payload.pdf"`
      );
      
      return res.send(pdfBuffer);
    } catch (error: any) {
      return res.status(500).json({
        message: error.message || "ไม่สามารถสร้างรายงาน PDF ได้",
      });
    }
  }
}
