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
exports.BagHandoverController = void 0;
const baghandover_service_1 = require("../Service/baghandover.service");
class BagHandoverController {
    /**
     * GET /api/bag-handover/:campaignId
     * ตัวอย่าง: /api/bag-handover/camp-1
     */
    static getForCampaign(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { campaignId } = req.params;
                if (!campaignId) {
                    return res.status(400).json({ message: "Missing campaignId" });
                }
                const result = yield baghandover_service_1.BagHandoverService.getForCampaign(campaignId);
                res.json(result);
            }
            catch (err) {
                console.error("Controller Error (BagHandover getForCampaign):", err);
                res.status(500).json({ message: (_a = err.message) !== null && _a !== void 0 ? _a : "Internal server error" });
            }
        });
    }
    /**
     * POST /api/bag-handover/check-in
     * body:
     * {
     *   campaignId: "camp-1",
     *   sessionId: 10,
     *   bagNo: 3,
     *   graderId: 5,
     *   operatorId: 1,
     *   note?: "..."
     * }
     */
    static checkIn(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const { campaignId, sessionId, bagNo, graderId, operatorId, note, } = (_a = req.body) !== null && _a !== void 0 ? _a : {};
                if (!campaignId ||
                    !sessionId ||
                    !bagNo ||
                    !graderId ||
                    !operatorId) {
                    return res
                        .status(400)
                        .json({ message: "Missing required fields for check-in" });
                }
                yield baghandover_service_1.BagHandoverService.checkIn({
                    campaignId,
                    sessionId: Number(sessionId),
                    bagNo: Number(bagNo),
                    graderId: Number(graderId),
                    operatorId: Number(operatorId),
                    note,
                });
                res.status(201).json({ message: "Bag check-in recorded" });
            }
            catch (err) {
                console.error("Controller Error (BagHandover checkIn):", err);
                res.status(500).json({ message: (_b = err.message) !== null && _b !== void 0 ? _b : "Internal server error" });
            }
        });
    }
    /**
     * POST /api/bag-handover/check-out
     * body:
     * {
     *   campaignId: "camp-1",
     *   sessionId: 10,
     *   bagNo: 3,
     *   operatorId: 1,
     *   note?: "..."
     * }
     */
    static checkOut(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const { campaignId, sessionId, bagNo, operatorId, note } = (_a = req.body) !== null && _a !== void 0 ? _a : {};
                if (!campaignId || !sessionId || !bagNo || !operatorId) {
                    return res
                        .status(400)
                        .json({ message: "Missing required fields for check-out" });
                }
                yield baghandover_service_1.BagHandoverService.checkOut({
                    campaignId,
                    sessionId: Number(sessionId),
                    bagNo: Number(bagNo),
                    operatorId: Number(operatorId),
                    note,
                });
                res.status(201).json({ message: "Bag check-out recorded" });
            }
            catch (err) {
                console.error("Controller Error (BagHandover checkOut):", err);
                res.status(500).json({ message: (_b = err.message) !== null && _b !== void 0 ? _b : "Internal server error" });
            }
        });
    }
}
exports.BagHandoverController = BagHandoverController;
