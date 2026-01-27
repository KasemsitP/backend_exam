import { Router } from "express";
import { graderController } from "../Controller/grader.controller";

const graderRouter = Router();

graderRouter.get(
  "/graders/campaign/:campaignId",
  graderController.getByCampaignId
);
graderRouter.get(
  "/graders/assignment/:campaign_id/:account_id",
  graderController.getAssignmentByAccountId
);


export default graderRouter;