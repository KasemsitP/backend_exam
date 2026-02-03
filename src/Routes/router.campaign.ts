import { Router } from "express";
import { campaignController } from "../Controller/campaign.controller";

const campaignRouter = Router();
campaignRouter.post("/campaigns", campaignController.create);
campaignRouter.delete("/campaigns/:id", campaignController.delete);
campaignRouter.put("/campaigns", campaignController.update);
campaignRouter.get("/campaigns/:campaign_id/is-unlock", campaignController.getIsUnlock);
export default campaignRouter;