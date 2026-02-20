"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const signsheet_controller_1 = require("../Controller/signsheet.controller");
const router = (0, express_1.Router)();
// โหลด PDF (มีอยู่แล้ว)
router.get("/signsheet/campaign/:campaign_id/session/:session_id/pdf", signsheet_controller_1.SignSheetController.createPDF);
//  โหลดรายชื่อผู้สอบแบบ pagination
router.get("/signsheet/campaign/:campaign_id/session/:session_id", signsheet_controller_1.SignSheetController.listPaginated);
exports.default = router;
