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
exports.GradingRecheckController = void 0;
const gradingrecheck_service_1 = require("../Service/gradingrecheck.service");
class GradingRecheckController {
    // สแกน QR เพื่อหา slot สำหรับ recheck (reuse logic เดิม)
    static createRecheckSlot(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { qrPayload, campaignId, graderId, questionNo } = req.body;
                if (!qrPayload || !campaignId || !graderId || !questionNo) {
                    return res.status(400).send({ message: "ข้อมูลไม่ครบ" });
                }
                const result = yield gradingrecheck_service_1.gradingRecheckService.createRecheckSlotFromQr({
                    qrPayload,
                    campaignId: Number(campaignId),
                    graderId: Number(graderId),
                    questionNo: Number(questionNo),
                });
                return res.status(201).json(result);
            }
            catch (error) {
                console.error(error);
                return res.status(400).send({ message: (_a = error.message) !== null && _a !== void 0 ? _a : "เกิดข้อผิดพลาด" });
            }
        });
    }
    // reset คะแนนของข้อหนึ่งให้ recheck ใหม่
    static resetRecheck(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const slotId = Number(req.params.slotId);
                if (!slotId) {
                    return res.status(400).json({ message: "slotId ไม่ถูกต้อง" });
                }
                yield gradingrecheck_service_1.gradingRecheckService.resetQuestionForRecheck({ slotId });
                return res.json({ message: "รีเซ็ตคะแนนเพื่อ recheck เรียบร้อยแล้ว" });
            }
            catch (err) {
                console.error(err);
                return res
                    .status(500)
                    .json({ message: err.message || "Internal Server Error" });
            }
        });
    }
    static scanDisputed(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { qrPayload, campaignId } = req.body;
                if (!qrPayload || !campaignId) {
                    return res.status(400).json({ message: "ข้อมูลไม่ครบ" });
                }
                const result = yield gradingrecheck_service_1.gradingRecheckService.scanDisputedFromQr({
                    qrPayload,
                    campaignId: Number(campaignId),
                });
                return res.json(result);
            }
            catch (err) {
                console.error(err);
                return res
                    .status(400)
                    .json({ message: (_a = err.message) !== null && _a !== void 0 ? _a : "เกิดข้อผิดพลาด" });
            }
        });
    }
    static listDisputed(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { campaign_id } = req.params;
                const threshold = req.query.threshold
                    ? Number(req.query.threshold)
                    : 4;
                console.log(campaign_id);
                const rows = yield gradingrecheck_service_1.gradingRecheckService.listDisputedQuestions(threshold, Number(campaign_id));
                return res.json(rows);
            }
            catch (err) {
                console.error(err);
                return res
                    .status(500)
                    .json({ message: err.message || "Internal Server Error" });
            }
        });
    }
}
exports.GradingRecheckController = GradingRecheckController;
