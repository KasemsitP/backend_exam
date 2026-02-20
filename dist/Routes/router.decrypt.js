"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/campaignDecrypt.route.ts (ตัวอย่าง)
const express_1 = __importDefault(require("express"));
//import { requireAdminOrManager } from "../middleware/auth";
const decrypted_controller_1 = require("../Controller/decrypted.controller");
const router = express_1.default.Router();
router.post("/campaigns/:campaignId/decrypt", decrypted_controller_1.decryptedController.decryptedUnlock);
exports.default = router;
