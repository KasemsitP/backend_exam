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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SeatPlanController = void 0;
const seatplan_service_1 = require("../Service/seatplan.service");
class SeatPlanController {
}
exports.SeatPlanController = SeatPlanController;
_a = SeatPlanController;
SeatPlanController.createPDF = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { session_id, campaign_id } = req.params;
        if (!session_id || !campaign_id) {
            return res.status(400).json({
                message: "Invalid campaign_id or session_id",
            });
        }
        const pdfBuffer = yield seatplan_service_1.SeatPlanService.generateSeatPlanPdf({
            session_id: Number(session_id),
            campaign_id: Number(campaign_id),
        });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="seatplan_${campaign_id}_${session_id}.pdf"`);
        res.send(pdfBuffer);
    }
    catch (err) {
        console.error("generate seat plan pdf error:", err);
        res.status(500).json({ message: "ไม่สามารถสร้างผังที่นั่งสอบได้" });
    }
});
SeatPlanController.nameLists = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { campaign_id } = req.params;
        const buffer = yield seatplan_service_1.SeatPlanService.generateSeatPlanNameListPdf({
            campaign_id: Number(campaign_id)
        });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="seatplan_name_list_${campaign_id}.pdf"`);
        res.send(buffer);
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ message: "ไม่สามารถสร้าง PDF รายชื่อได้" });
    }
});
