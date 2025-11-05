import { Router } from "express";
import { authcontroller } from "../Controller/auth.controller";
const roleRouter = Router();
roleRouter.get("/roles/", authcontroller.getRoles);
export { roleRouter };
