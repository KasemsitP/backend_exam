"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/router/gradingslot.router.ts หรือ router แยก recheck โดยเฉพาะ
const express_1 = require("express");
const gradingrecheck_controller_1 = require("../Controller/gradingrecheck.controller");
const gradingRecheckRouter = (0, express_1.Router)();
gradingRecheckRouter.get("/recheck/disputed/:campaign_id", 
// requireAuth,
// requirePermission("manage_grading"),
gradingrecheck_controller_1.GradingRecheckController.listDisputed);
// สแกน QR เพื่อ "เปิด slot recheck" (จริง ๆ reuse createSlotFromQr)
gradingRecheckRouter.post("/recheck/slot-from-qr", gradingrecheck_controller_1.GradingRecheckController.createRecheckSlot);
// reset คะแนนของข้อหนึ่ง (slotId ตัวใดตัวหนึ่งในคู่นั้นก็ได้)
gradingRecheckRouter.post("/recheck/reset/:slotId/:userId", gradingrecheck_controller_1.GradingRecheckController.resetRecheck);
gradingRecheckRouter.post("/recheck/reset-score", gradingrecheck_controller_1.GradingRecheckController.ResetScore);
exports.default = gradingRecheckRouter;
