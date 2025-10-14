import express from "express";
import { isAuthenticated } from "../Middleware/authentication";
import { usercontroller } from "../Controller/user.controller";
const router = express.Router();
router.get("/usersByCampagin",usercontroller.getUsersByCampagin)




export default router;




