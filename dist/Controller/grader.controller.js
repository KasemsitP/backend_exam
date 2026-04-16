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
exports.graderController = void 0;
const grader_service_1 = require("../Service/grader.service");
const graderbag_report_service_1 = require("../Service/graderbag-report.service");
class graderController {
    static printBagScorePayloadPdf(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const bagId = Number(req.params.bagId);
                const questionNo = Number(req.params.questionNo);
                const graderId = Number(req.params.graderId);
                console.log("HIT printBagScorePayloadPdf", { bagId, questionNo, graderId });
                if (!bagId || !questionNo || !graderId) {
                    return res.status(400).json({
                        message: "bagId หรือ questionNo หรือ graderId ไม่ถูกต้อง",
                    });
                }
                const pdfBuffer = yield graderbag_report_service_1.GraderBagReportService.generateBagScorePayloadPdf(bagId, questionNo, graderId);
                res.setHeader("Content-Type", "application/pdf");
                res.setHeader("Content-Disposition", `inline; filename="bag_${bagId}_question_${questionNo}_score_payload.pdf"`);
                return res.send(pdfBuffer);
            }
            catch (error) {
                return res.status(500).json({
                    message: error.message || "ไม่สามารถสร้างรายงาน PDF ได้",
                });
            }
        });
    }
}
exports.graderController = graderController;
_a = graderController;
graderController.getByCampaignId = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _b;
    try {
        const raw = req.params.campaignId;
        if (!raw) {
            return res
                .status(400)
                .send({ message: "Missing campaignId parameter" });
        }
        const campaignIdNumeric = Number(raw);
        if (Number.isNaN(campaignIdNumeric) || campaignIdNumeric <= 0) {
            return res
                .status(400)
                .send({ message: "campaignId must be a positive number" });
        }
        // ✅ ตอนนี้จะได้ array ของ ApiGrader ที่มี question_no
        const graders = yield grader_service_1.graderService.getAllByCampaignId(campaignIdNumeric);
        return res.status(200).json(graders);
    }
    catch (error) {
        console.error("Controller Error (graderController.getByCampaignId):", error);
        return res
            .status(500)
            .send({ message: (_b = error.message) !== null && _b !== void 0 ? _b : "Server error" });
    }
});
graderController.getAssignmentByAccountId = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _b;
    try {
        const { campaign_id, account_id } = req.params;
        console.log(campaign_id, account_id);
        if (!campaign_id || !account_id) {
            return res
                .status(400).send({ message: "Missing campaignId parameter" });
        }
        const result = yield grader_service_1.graderService.getAssignmentByAccountId(Number(campaign_id), Number(account_id));
        return res.status(200).json(result);
    }
    catch (error) {
        return res
            .status(500)
            .send({ message: (_b = error.message) !== null && _b !== void 0 ? _b : "Server error" });
    }
});
graderController.getConfirmedBags = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const campaignId = Number(req.params.campaignId);
        const graderId = Number(req.params.graderId);
        if (!campaignId || !graderId) {
            return res.status(400).json({ message: "ข้อมูลไม่ถูกต้อง" });
        }
        const rows = yield grader_service_1.graderService.getBagFinished(campaignId, graderId);
        return res.status(200).json(rows);
    }
    catch (error) {
        return res.status(500).json({
            message: error.message || "โหลดข้อมูลไม่สำเร็จ",
        });
    }
});
