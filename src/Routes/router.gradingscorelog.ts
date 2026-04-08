

import { Router } from "express";
import { gradingScoreLogController } from "../Controller/grading_score_log.controller";

const gradingScoreLogRouter = Router();

gradingScoreLogRouter.get(
  "/gradingscorelog/:bagId",
  gradingScoreLogController.getScoreLogByBagId
);

export default gradingScoreLogRouter;