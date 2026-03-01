"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardController = void 0;
const dashboard_service_1 = require("../Service/dashboard.service");
class DashboardController {
    static getCampaignDashboard(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const campaignId = Number(req.params.campaignId);
            console.log("Received request for campaignId:", campaignId);
            if (isNaN(campaignId)) {
                return res.status(400).json({ message: "invalid campaign id" });
            }
            try {
                const data = yield dashboard_service_1.DashboardService.getCampaignDashboardSummary(campaignId);
                res.json(data);
            }
            catch (err) {
                console.error("getCampaignDashboard error:", err);
                res.status(500).json({ message: "โหลด dashboard ไม่สำเร็จ" });
            }
        });
    }
    static getCampaignChart(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const campaignId = Number(req.params.campaignId);
            console.log("Received request for campaignId:", campaignId);
            if (isNaN(campaignId)) {
                return res.status(400).json({ message: "invalid campaign id" });
            }
            try {
                const data = yield dashboard_service_1.DashboardService.getCampaignDashboardCharts(campaignId);
                res.json(data);
            }
            catch (err) {
                console.error("getCampaignChart error:", err);
                res.status(500).json({ message: "โหลด dashboard ไม่สำเร็จ" });
            }
        });
    }
    static getCampaignSlotCoverage(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const campaignId = Number(req.params.campaignId);
            console.log("Received request for campaignId:", campaignId);
            if (isNaN(campaignId)) {
                return res.status(400).json({ message: "invalid campaign id" });
            }
            try {
                const data = yield dashboard_service_1.DashboardService.getCampaignDashboardSlotCoverage(campaignId);
                res.json(data);
            }
            catch (err) {
                console.error("getCampaignSlotCoverage error:", err);
                res.status(500).json({ message: "โหลด dashboard ไม่สำเร็จ" });
            }
        });
    }
}
exports.DashboardController = DashboardController;
