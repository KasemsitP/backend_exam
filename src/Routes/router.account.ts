import { Router } from "express";
import { authcontroller } from "../Controller/auth.controller";

const accountRouter = Router();
accountRouter.get("/accounts/", authcontroller.getAll);
accountRouter.get("/accounts/graders/:id", authcontroller.getAllGraders);
accountRouter.put("/accounts/:id", authcontroller.update);
accountRouter.delete("/accounts/:id", authcontroller.delete);
export { accountRouter };