import { Router } from "express";
import { campaignController } from "../Controller/campaign.controller";

const campaignRouter = Router();
campaignRouter.post("/campaigns", campaignController.create);
campaignRouter.delete("/campaigns/:id", campaignController.delete);
campaignRouter.put("/campaigns", campaignController.update);
export default campaignRouter;