// routes/campaignDecrypt.route.ts (ตัวอย่าง)
import express from "express";
//import { requireAdminOrManager } from "../middleware/auth";
import { decryptedController } from "../Controller/decrypted.controller";

const router = express.Router();

router.post("/campaigns/:campaignId/decrypt",decryptedController.decryptedUnlock);
export default router;
