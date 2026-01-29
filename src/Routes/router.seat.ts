import { Router } from "express";
import { seatController } from "../Controller/seat.controller"

const router = Router()
router.get(
    "/seat/campaign/:campaign_id/room/:roomCode",
    seatController.getSeat
);
router.get(
    "/seat/campaign/:campaign_id/room/:roomCode/preview",
    seatController.ArrangeMent
);
router.post(
    "/seat/campaign/:campaign_id/room/:roomCode/confirm",
    seatController.CreateSeat
);

router.get("/seat/isassigned/:campaign_id",seatController.IsAssigned)
router.get("/seat/countusers/:campaign_id",seatController.getUserCount)
router.delete("/seat/reset/:campaign_id",seatController.ResetSeat)

export default router;