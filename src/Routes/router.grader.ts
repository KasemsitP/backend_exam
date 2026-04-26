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

graderRouter.get(
  "/graders/confirmed-bags/:campaignId/:graderId",
  graderController.getConfirmedBags
);

graderRouter.get("/graders/bags/:bagId/score-payload/:questionNo/:graderId/pdf", graderController.printBagScorePayloadPdf);

graderRouter.get(
  "/graders/bags/:bagId/manual-payload/:graderId/pdf",
  graderController.printBagManualPayloadPdf
);

export default graderRouter;