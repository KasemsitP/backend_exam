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
}
