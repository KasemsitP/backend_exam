"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/router/gradingslot.router.ts หรือ router แยก recheck โดยเฉพาะ
const express_1 = require("express");
const gradingRecheck_controller_1 = require("../Controller/gradingRecheck.controller");
const gradingRecheckRouter = (0, express_1.Router)();
gradingRecheckRouter.get("/recheck/disputed/:campaign_id", 
// requireAuth,
// requirePermission("manage_grading"),
gradingRecheck_controller_1.GradingRecheckController.listDisputed);
// สแกน QR เพื่อ "เปิด slot recheck" (จริง ๆ reuse createSlotFromQr)
gradingRecheckRouter.post("/recheck/slot-from-qr", gradingRecheck_controller_1.GradingRecheckController.createRecheckSlot);
// reset คะแนนของข้อหนึ่ง (slotId ตัวใดตัวหนึ่งในคู่นั้นก็ได้)
gradingRecheckRouter.post("/recheck/reset/:slotId", gradingRecheck_controller_1.GradingRecheckController.resetRecheck);
gradingRecheckRouter.post("/grading/recheck/scan-disputed", gradingRecheck_controller_1.GradingRecheckController.scanDisputed);
exports.default = gradingRecheckRouter;
