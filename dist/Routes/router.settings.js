"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const settings_controller_1 = require("../Controller/settings.controller");
const router = (0, express_1.Router)();
router.get("/settings/campaign/:campaign_id", settings_controller_1.SettingsController.getSettingStatus);
router.patch("/settings/set/active/campaign/:campaign_id", settings_controller_1.SettingsController.updateActiveCamp);
router.patch("/settings/set/active/keys/:campaign_id", settings_controller_1.SettingsController.updateActiveKeys);
exports.default = router;
