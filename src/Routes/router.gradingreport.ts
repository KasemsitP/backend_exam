import { Router } from "express";
import { GradingReportController } from "../Controller/grading-report.controller";

const reportRouter = Router();

reportRouter.get(
  "/reports/bags/:bagId/scores",
  GradingReportController.getBagSubjectScores
);

reportRouter.get(
  "/reports/bags/:bagId/scores/pdf",
  GradingReportController.ReportScorePDF
);

reportRouter.get(
  "/reports/campaigns/:campaign_id/scoreall/pdf",
  GradingReportController.ReportScoreAllPDF
);

reportRouter.get(
  "/reports/bags/:bag_id/graders/:grader_id/summary-pdf",
  GradingReportController.ReportScoreGraders
);


export default reportRouter;