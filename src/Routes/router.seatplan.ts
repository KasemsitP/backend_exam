import { Router } from "express";
import { SeatPlanController } from "../Controller/seatplan.controller";

const router = Router();

// GET /api/seatplan/campaign/:campaign_id/session/:session_id/pdf
router.get(
  "/seatplan/campaign/:campaign_id/session/:session_id/pdf",
  SeatPlanController.createPDF
);

router.get(
  "/seatplan/campaign/:campaign_id/name-list-pdf",SeatPlanController.nameLists)

export default router;
