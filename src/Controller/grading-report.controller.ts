// src/Controller/gradingReport.controller.ts
import { Request, Response } from "express";
import { GradingReportService } from "../Service/grading-report.service";

export class GradingReportController {
  /**
   * GET /api/reports/bags/:bagId/subjects/:subjectId/scores
   */
  static async getBagSubjectScores(req: Request, res: Response) {
    try {
      const bagId = Number(req.params.bagId);
      // const subjectId = Number(req.params.subjectId);

      if (Number.isNaN(bagId)) { //|| Number.isNaN(subjectId
        return res.status(400).json({ message: "Invalid bagId or subjectId" });
      }

      const result = await GradingReportService.getBagScoresReport(
        bagId,
        //subjectId
      );

      res.json(result);
    } catch (err: any) {
      console.error("Controller Error (getBagSubjectScores):", err);
      res
        .status(500)
        .json({ message: err?.message ?? "Internal server error" });
    }
  }
  static ReportScorePDF = async (req: Request, res: Response) => {
    const bagId = Number(req.params.bagId);
    try {
      const buf = await GradingReportService.generateBagScorePdf(bagId);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="bag-${bagId}-scores.pdf"`
      );
      res.send(buf);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "สร้าง PDF ไม่สำเร็จ" });
    }
  }
  static ReportScoreAllPDF = async (req: Request, res: Response) => {
    const {campaign_id } = req.params
   // console.log(campaign_id)
    try {
      const buf = await GradingReportService.generateCampaignBagScoresPdf(Number(campaign_id));
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="campaign-${campaign_id}-scores.pdf"`
      );
      res.send(buf);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "สร้าง PDF ไม่สำเร็จ" });
    }
  }

  static ReportScoreGraders = async (req: Request, res: Response) => {
    const {bag_id , grader_id} = req.params
   // console.log(campaign_id)
       try {
      const bagId = Number(bag_id);
      const graderId = Number(grader_id);
      console.log(bagId , graderId)

      // ดึงชื่อผู้ตรวจจากฐานข้อมูลเอง
      const graderName = req.query.graderName as string || "................................";

      const pdfBuffer = await GradingReportService.generateGraderBagSummaryPdf(
        bagId,
        graderId,
        graderName
      );

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="grader-summary-bag-${bagId}-grader-${graderId}.pdf"`
      );
      res.send(pdfBuffer);
    } catch (err : any) {
       res.status(500).json({ message: "สร้าง PDF คะแนนผู้ตรวจไม่สำเร็จ" });
    }
  }
}
