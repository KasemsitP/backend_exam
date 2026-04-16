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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const gradingscoredraft_service_1 = __importDefault(require("../Service/gradingscoredraft.service"));
class GradingScoreDraftController {
}
_a = GradingScoreDraftController;
GradingScoreDraftController.saveDraftScore = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { slotId, campaignId, graderId, question_no, score } = req.body;
        console.log(req.body);
        if (slotId === undefined ||
            campaignId === undefined ||
            graderId === undefined ||
            question_no === undefined ||
            score === undefined) {
            return res.status(400).json({
                message: "ข้อมูลไม่ครบ",
            });
        }
        const result = yield gradingscoredraft_service_1.default.saveDraftScore({
            slotId: Number(slotId),
            campaignId: Number(campaignId),
            graderId: Number(graderId),
            questionNo: Number(question_no),
            score: Number(score),
        });
        return res.status(200).json({
            message: "บันทึกคะแนน draft สำเร็จ",
            data: result,
        });
    }
    catch (error) {
        return res.status(500).json({
            message: error.message || "เกิดข้อผิดพลาดในการบันทึก draft score",
        });
    }
});
GradingScoreDraftController.getDraftsByBagId = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const bagId = Number(req.params.bagId);
        if (!bagId) {
            return res.status(400).json({
                message: "bagId ไม่ถูกต้อง",
            });
        }
        const result = yield gradingscoredraft_service_1.default.getDraftsByBagId(bagId);
        return res.status(200).json({
            message: "ดึง draft scores สำเร็จ",
            data: result,
        });
    }
    catch (error) {
        return res.status(500).json({
            message: error.message || "เกิดข้อผิดพลาดในการดึง draft scores",
        });
    }
});
GradingScoreDraftController.getDraftsUnconfirmed = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const graderId = Number(req.params.graderId);
        if (!graderId) {
            return res.status(400).json({
                message: "graderId ไม่ถูกต้อง",
            });
        }
        const result = yield gradingscoredraft_service_1.default.getDraftsUnconfirmed(graderId);
        return res.status(200).json({
            message: "ดึง draft scores สำเร็จ",
            data: result,
        });
    }
    catch (error) {
        return res.status(500).json({
            message: error.message || "เกิดข้อผิดพลาดในการดึง draft scores",
        });
    }
});
GradingScoreDraftController.confirmBagScores = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { bagId, graderId, scores } = req.body;
        if (!bagId || !graderId || !Array.isArray(scores) || scores.length === 0) {
            return res.status(400).json({
                message: "ข้อมูลไม่ครบ",
            });
        }
        const result = yield gradingscoredraft_service_1.default.confirmBagScores({
            bagId: Number(bagId),
            graderId: Number(graderId),
            scores: scores.map((s) => ({
                slot_id: Number(s.slot_id),
                question_no: Number(s.question_no),
                score: Number(s.score),
            })),
        });
        return res.status(200).json({
            message: "ยืนยันคะแนนทั้งถุงสำเร็จ",
            data: result,
        });
    }
    catch (error) {
        return res.status(500).json({
            message: error.message || "เกิดข้อผิดพลาดในการยืนยันคะแนน",
        });
    }
});
GradingScoreDraftController.cancelDraftScore = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { slotId } = req.body;
        if (slotId === undefined) {
            return res.status(400).json({
                message: "slotId ไม่ถูกต้อง",
            });
        }
        const result = yield gradingscoredraft_service_1.default.cancelDraftScore({
            slotId: Number(slotId),
        });
        return res.status(200).json({
            message: "ยกเลิก draft score สำเร็จ",
            data: result,
        });
    }
    catch (error) {
        return res.status(500).json({
            message: error.message || "เกิดข้อผิดพลาดในการยกเลิก draft score",
        });
    }
});
exports.default = GradingScoreDraftController;
