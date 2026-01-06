import { Router } from "express";
import { keyController } from "../Controller/key.controller";

const keyRouter = Router();

keyRouter.get("/keys/campaign/:campaignId",keyController.getAllForCampaign);
keyRouter.get("/keys/campaign/:campaignId/:AccountId",keyController.getAllForCampaignManager);
keyRouter.post("/keys", keyController.create);
keyRouter.delete("/keys/:id", keyController.delete);
keyRouter.get("/keys/prerequisites/:campaignId", keyController.getPrerequisites);
keyRouter.post("/keys/encrypt-session-bulk", keyController.runBulkEncryption);
keyRouter.post("/keys/test-decrypt", keyController.testDecrypt);
keyRouter.get("/keys/dashboard/:campaignId", keyController.getDashboard);



export default keyRouter;
