import { Router } from "express";
import { GradingReportController } from "../Controller/grading-report.controller";

const reportRouter = Router();

reportRouter.get(
  "/reports/bags/:bagId/scores",
  GradingReportController.getBagSubjectScores
);

export default reportRouter;