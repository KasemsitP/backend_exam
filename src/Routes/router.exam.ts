import { Router } from "express";
import { examDataController } from "../Controller/exam.controller";
const examDataRouter = Router();

examDataRouter.get("/exam-data",examDataController.getInitialData);
examDataRouter.get("/exam-campaign",examDataController.getCampaignNoactive);

export default examDataRouter;