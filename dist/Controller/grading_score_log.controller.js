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
exports.gradingScoreLogController = void 0;
const grading_score_log_service_1 = require("../Service/grading_score_log.service");
class gradingScoreLogController {
}
exports.gradingScoreLogController = gradingScoreLogController;
_a = gradingScoreLogController;
gradingScoreLogController.getScoreLogByBagId = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _b;
    try {
        const bagId = Number(req.params.bagId);
        if (isNaN(bagId) || bagId <= 0) {
            return res.status(400).json({ message: "bagId ต้องเป็นตัวเลขบวก" });
        }
        const scoreLog = yield grading_score_log_service_1.gradingScoreLogService.getScoreLogByBagId(bagId);
        console.log("Score Log for bagId", bagId, ":", scoreLog);
        res.status(200).json(scoreLog);
    }
    catch (error) {
        console.error("Controller Error (gradingScoreLogController.getScoreLogByBagId):", error);
        res.status(500).json({ message: (_b = error === null || error === void 0 ? void 0 : error.message) !== null && _b !== void 0 ? _b : "Failed to get score log" });
    }
});
