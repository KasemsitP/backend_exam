// src/router/gradingslot.router.ts หรือ router แยก recheck โดยเฉพาะ
import { Router } from "express";
import { GradingRecheckController } from "../Controller/gradingrecheck.controller";

const gradingRecheckRouter = Router();

gradingRecheckRouter.get(
  "/recheck/disputed/:campaign_id",
  // requireAuth,
  // requirePermission("manage_grading"),
  GradingRecheckController.listDisputed
);

// สแกน QR เพื่อ "เปิด slot recheck" (จริง ๆ reuse createSlotFromQr)
gradingRecheckRouter.post(
  "/recheck/slot-from-qr",
  GradingRecheckController.createRecheckSlot
);

// reset คะแนนของข้อหนึ่ง (slotId ตัวใดตัวหนึ่งในคู่นั้นก็ได้)
gradingRecheckRouter.post(
  "/recheck/reset/:slotId",
  GradingRecheckController.resetRecheck
);

export default gradingRecheckRouter;
