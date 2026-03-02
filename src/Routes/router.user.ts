import express from "express";
import { isAuthenticated } from "../Middleware/authentication";
import { usercontroller } from "../Controller/user.controller";
const router = express.Router();
//router.get("/usersByCampagin",usercontroller.getUsersByCampagin)
router.get("/user/:campaignId",usercontroller.getCountUserCampaign)




export default router;




