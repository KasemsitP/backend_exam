import { Router } from "express";
import { examDataController } from "../Controller/exam.controller";
const examDataRouter = Router();

examDataRouter.get("/exam-data",examDataController.getInitialData);
examDataRouter.get("/exam-campaign",examDataController.getCampaignNoactive);
examDataRouter.post("/exam/active/:campaign_id",examDataController.ActiveInActiveCampaign);

export default examDataRouter;