"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const user_controller_1 = require("../Controller/user.controller");
const router = express_1.default.Router();
//router.get("/usersByCampagin",usercontroller.getUsersByCampagin)
router.get("/user/:campaignId", user_controller_1.usercontroller.getCountUserCampaign);
exports.default = router;
