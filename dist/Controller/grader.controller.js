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
class graderController {
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
