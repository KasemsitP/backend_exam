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
exports.gradingscoreController = void 0;
const gradingscore_service_1 = require("../Service/gradingscore.service");
const gradingscore_repo_1 = __importDefault(require("../Repo/gradingscore.repo"));
class gradingscoreController {
}
exports.gradingscoreController = gradingscoreController;
_a = gradingscoreController;
gradingscoreController.SubmitScore = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { qrPayload, campaignId, slotId, graderId, score, question_no } = req.body;
        if (!qrPayload || !campaignId || !graderId || !slotId || score === undefined || question_no === undefined) {
            return res.status(400).send({ message: "ข้อมูลไม่ครบ" });
        }
        const payload = {
            qrPayload,
            campaignId: Number(campaignId),
            graderId: Number(graderId),
            slotId: Number(slotId),
            score: Number(score),
            question_no: Number(question_no),
        };
        const result = yield gradingscore_service_1.gradingScoreService.submitScore(payload);
        res.status(201).json({ slotId: result.slotId, score: result.score });
    }
    catch (error) {
        res.status(400).send({ message: error.message });
    }
});
gradingscoreController.FetchRecord = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { graderId } = req.params;
        if (!graderId) {
            return res.status(400).send({ message: "ไม่พบผู้ตรวจ" });
        }
        const result = yield gradingscore_repo_1.default.FindAllRecord(Number(graderId));
        res.status(201).json(result);
    }
    catch (error) {
        res.status(400).send({ message: error.message });
    }
});
