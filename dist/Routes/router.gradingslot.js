"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const gradingslot_controller_1 = require("../Controller/gradingslot.controller");
const gradingslotRouter = (0, express_1.Router)();
gradingslotRouter.post("/gradingslots/verify", gradingslot_controller_1.gradingslotController.CreateSlot);
gradingslotRouter.post("/gradingslots/preview-start", gradingslot_controller_1.gradingslotController.previewStartFromQr);
gradingslotRouter.post("/gradingslots/confirm-start", gradingslot_controller_1.gradingslotController.confirmStartFromQr);
exports.default = gradingslotRouter;
