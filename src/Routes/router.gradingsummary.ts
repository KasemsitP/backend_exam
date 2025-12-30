import { Router } from "express";
import { GradingSummaryController } from "../Controller/grading-summary.controller";

const gradingSummaryRouter = Router();

gradingSummaryRouter.get(
  "/grading-summary/check",
  GradingSummaryController.checkGraderHistory
);

gradingSummaryRouter.get(
  "/grading-summary/bag-progress/:bagId",
  GradingSummaryController.getBagProgress
);

export default gradingSummaryRouter;