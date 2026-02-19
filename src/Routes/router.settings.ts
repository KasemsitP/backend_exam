
import { Router } from "express";
import { SettingsController } from "../Controller/settings.controller";

const router = Router();
router.get("/settings/campaign/:campaign_id", SettingsController.getSettingStatus);
router.patch("/settings/set/active/campaign/:campaign_id", SettingsController.updateActiveCamp);
router.patch("/settings/set/active/keys/:campaign_id", SettingsController.updateActiveKeys);
export default router;