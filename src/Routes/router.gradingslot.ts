

import { Router } from "express";
import { gradingslotController } from "../Controller/gradingslot.controller";

const gradingslotRouter = Router();

gradingslotRouter.post(
  "/gradingslots/verify",
  gradingslotController.CreateSlot
);

export default gradingslotRouter;