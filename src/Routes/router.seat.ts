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

export default router;