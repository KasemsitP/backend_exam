import { Router } from "express";
import { graderController } from "../Controller/grader.controller";

const graderRouter = Router();

graderRouter.get(
  "/graders/campaign/:campaignId",
  graderController.getByCampaignId
);

export default graderRouter;