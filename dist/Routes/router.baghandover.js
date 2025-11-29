"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/Routes/router.baghandover.ts
const express_1 = require("express");
const baghandover_controller_1 = require("../Controller/baghandover.controller");
// ถ้าต้องการ auth middleware ก็ import มาครอบภายหลังได้ เช่น isAuthenticated
const bagHandoverRouter = (0, express_1.Router)();
bagHandoverRouter.get("/bag-handover/:campaignId", baghandover_controller_1.BagHandoverController.getForCampaign);
bagHandoverRouter.post("/bag-handover/check-in", baghandover_controller_1.BagHandoverController.checkIn);
bagHandoverRouter.post("/bag-handover/check-out", baghandover_controller_1.BagHandoverController.checkOut);
exports.default = bagHandoverRouter;
