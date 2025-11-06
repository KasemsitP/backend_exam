"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const key_controller_1 = require("../Controller/key.controller");
// import { isAuth, isAdmin } from "../middleware/auth.middleware"; // (Middleware สำหรับตรวจสอบสิทธิ์)
const keyRouter = (0, express_1.Router)();
keyRouter.get("/keys/campaign/:campaignId", key_controller_1.keyController.getAllForCampaign);
keyRouter.post("/keys", key_controller_1.keyController.create);
keyRouter.delete("/keys/:id", key_controller_1.keyController.delete);
keyRouter.get("/keys/prerequisites/:campaignId", key_controller_1.keyController.getPrerequisites);
keyRouter.post("/keys/encrypt-session-bulk", key_controller_1.keyController.runBulkEncryption);
keyRouter.post("/keys/test-decrypt", key_controller_1.keyController.testDecrypt);
exports.default = keyRouter;
