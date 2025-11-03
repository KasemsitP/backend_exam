import { Router } from "express";
import { keyController } from "../Controller/key.controller";
// import { isAuth, isAdmin } from "../middleware/auth.middleware"; // (Middleware สำหรับตรวจสอบสิทธิ์)

const keyRouter = Router();

keyRouter.get("/keys/campaign/:campaignId",keyController.getAllForCampaign);
keyRouter.post("/keys", keyController.create);
keyRouter.delete("/keys/:id", keyController.delete);
keyRouter.get("/keys/prerequisites/:campaignId", keyController.getPrerequisites);
keyRouter.post("/keys/encrypt-session-bulk", keyController.runBulkEncryption);
keyRouter.post("/keys/test-decrypt", keyController.testDecrypt);



export default keyRouter;
