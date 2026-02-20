"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const seatplan_controller_1 = require("../Controller/seatplan.controller");
const router = (0, express_1.Router)();
// GET /api/seatplan/campaign/:campaign_id/session/:session_id/pdf
router.get("/seatplan/campaign/:campaign_id/session/:session_id/pdf", seatplan_controller_1.SeatPlanController.createPDF);
router.get("/seatplan/campaign/:campaign_id/name-list-pdf", seatplan_controller_1.SeatPlanController.nameLists);
exports.default = router;
