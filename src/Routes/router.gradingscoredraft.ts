import { Router } from "express";
import GradingScoreDraftController from "../Controller/gradingscoredraft.controller";

const router = Router();

router.post("/gradingdraft/save", GradingScoreDraftController.saveDraftScore);
router.get("/gradingdraft/bag/:bagId", GradingScoreDraftController.getDraftsByBagId);
router.get("/gradingdraft/unconfirmed/:graderId", GradingScoreDraftController.getDraftsUnconfirmed);
router.post("/gradingdraft/confirm-bag", GradingScoreDraftController.confirmBagScores);
router.post("/gradingdraft/cancel", GradingScoreDraftController.cancelDraftScore);

export default router;