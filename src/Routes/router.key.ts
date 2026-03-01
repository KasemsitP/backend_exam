import { Router } from "express";
import { keyController } from "../Controller/key.controller";

const keyRouter = Router();

keyRouter.get("/keys/campaign/:campaignId",keyController.getAllForCampaign);
keyRouter.get("/keys/campaign/:campaignId/:AccountId",keyController.getAllForCampaignManager);
keyRouter.post("/keys", keyController.create);
keyRouter.delete("/keys/:campaignId/:accountId/:keyId", keyController.delete);
keyRouter.get("/keys/prerequisites/:campaignId", keyController.getPrerequisites);
keyRouter.post("/keys/encrypt-session-bulk", keyController.runBulkEncryption);
keyRouter.post("/keys/test-decrypt", keyController.testDecrypt);
keyRouter.post("/keys/forget", keyController.forgetKey);
keyRouter.get("/keys/dashboard/:campaignId", keyController.getDashboard);



keyRouter.post("/keys/test-mask", keyController.TestMask);
export default keyRouter;
