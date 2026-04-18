import { Router } from "express";
import { sessionController } from "../Controller/session.controller";

const sessionRouter = Router();
sessionRouter.post("/sessions", sessionController.create);
sessionRouter.put("/sessions/:id", sessionController.update);
sessionRouter.delete("/sessions/:id", sessionController.delete);

export default sessionRouter;