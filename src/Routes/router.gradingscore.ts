

import { Router } from "express";
import { gradingscoreController } from "../Controller/gradingscore.controller";

const gradingslotRouter = Router();

gradingslotRouter.post(
  "/gradingscore/submit",
  gradingscoreController.SubmitScore
);

gradingslotRouter.get("/gradingscore/record/:graderId",gradingscoreController.FetchRecord)

export default gradingslotRouter;