

import { Router } from "express";
import { gradingslotController } from "../Controller/gradingslot.controller";

const gradingslotRouter = Router();

gradingslotRouter.post(
  "/gradingslots/verify",
  gradingslotController.CreateSlot
);

gradingslotRouter.post("/gradingslots/preview-start", gradingslotController.previewStartFromQr);
gradingslotRouter.post("/gradingslots/confirm-start", gradingslotController.confirmStartFromQr);

export default gradingslotRouter;