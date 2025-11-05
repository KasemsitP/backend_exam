import { Router } from "express";
import { verifyController } from "../Controller/verify.controller";

const verifyRouter = Router();

verifyRouter.post("/verify/qr-payload", verifyController.verify);

export default verifyRouter;