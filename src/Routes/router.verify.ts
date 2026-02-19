import { Router } from "express";
import { verifyController } from "../Controller/verify.controller";

const verifyRouter = Router();

verifyRouter.post("/verify/qr-payload", verifyController.verify);
verifyRouter.post("/verify/check-booklets-orders", verifyController.CheckBookletsOrders);

export default verifyRouter;