import { Request, Response } from "express";
import { GradingSummaryService } from "../Service/grading-summary.service";

export class GradingSummaryController {
  
  // GET /api/grading-summary/check?graderId=1&bagId=458
  static async checkGraderHistory(req: Request, res: Response) {
    try {
      const { graderId, bagId } = req.query;
      
      if (!graderId || !bagId) {
        return res.status(400).json({ message: "Missing graderId or bagId" });
      }

      const result = await GradingSummaryService.checkGraderHistoryInBag(
        Number(graderId),
        Number(bagId)
      );
      res.json(result);
    } catch (err: any) {
      console.error("Error checking grader history:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  }

  // GET /api/grading-summary/bag-progress/:bagId
  static async getBagProgress(req: Request, res: Response) {
    try {
      const { bagId } = req.params;
      if (!bagId) {
        return res.status(400).json({ message: "Missing bagId" });
      }

      const result = await GradingSummaryService.getBagProgress(Number(bagId));
      res.json(result);
    } catch (err: any) {
      console.error("Error getting bag progress:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  }
}