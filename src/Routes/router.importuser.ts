import { Router } from "express";
import { userImportController } from "../Controller/importuser.controller";
// import { isAuth, isAdmin } from "../middleware/auth.middleware";

const userImportRouter = Router();

userImportRouter.post(
  "/import/campaign/:campaignId",
  // isAuth,
  // isAdmin,
  userImportController.importUsers
);

export default userImportRouter;
