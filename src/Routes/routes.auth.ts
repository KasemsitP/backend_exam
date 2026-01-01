import express from "express";
import { authcontroller } from "../Controller/auth.controller";
const router = express.Router();
router.post("/register",authcontroller.register)
router.post("/login", authcontroller.login)
router.delete("/logout", authcontroller.logout);
router.get("/me", authcontroller.getMe);
router.patch("/accounts/:id/revoke", authcontroller.revokeAccount);
router.patch("/accounts/:id/unrevoke", authcontroller.unrevokeAccount);

export default router;
