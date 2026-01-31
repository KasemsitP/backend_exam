import { Router } from "express";
import { SignSheetController } from "../Controller/signsheet.controller";

const router = Router();

// โหลด PDF (มีอยู่แล้ว)
router.get(
  "/signsheet/campaign/:campaign_id/session/:session_id/pdf",
  SignSheetController.createPDF
);

//  โหลดรายชื่อผู้สอบแบบ pagination
router.get(
  "/signsheet/campaign/:campaign_id/session/:session_id",
  SignSheetController.listPaginated
);

export default router;
