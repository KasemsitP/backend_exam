import { Router } from "express";
import { userSessionsController } from "../Controller/user-session.controller";

const router = Router();

router.get(
    "/user-sessions/session/:sessionId",
    userSessionsController.findBySessionId
);

export default router;
