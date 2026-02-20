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
exports.GradingSummaryController = void 0;
const grading_summary_service_1 = require("../Service/grading-summary.service");
class GradingSummaryController {
    // GET /api/grading-summary/check?graderId=1&bagId=458
    static checkGraderHistory(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { graderId, bagId } = req.query;
                if (!graderId || !bagId) {
                    return res.status(400).json({ message: "Missing graderId or bagId" });
                }
                const result = yield grading_summary_service_1.GradingSummaryService.checkGraderHistoryInBag(Number(graderId), Number(bagId));
                res.json(result);
            }
            catch (err) {
                console.error("Error checking grader history:", err);
                res.status(500).json({ message: "Internal server error" });
            }
        });
    }
    // GET /api/grading-summary/bag-progress/:bagId
    static getBagProgress(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { bagId } = req.params;
                if (!bagId) {
                    return res.status(400).json({ message: "Missing bagId" });
                }
                const result = yield grading_summary_service_1.GradingSummaryService.getBagProgress(Number(bagId));
                res.json(result);
            }
            catch (err) {
                console.error("Error getting bag progress:", err);
                res.status(500).json({ message: "Internal server error" });
            }
        });
    }
}
exports.GradingSummaryController = GradingSummaryController;
