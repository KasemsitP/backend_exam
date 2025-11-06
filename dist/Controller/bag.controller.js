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
exports.bagController = void 0;
const bag_service_1 = require("../Service/bag.service");
class bagController {
}
exports.bagController = bagController;
_a = bagController;
bagController.bulkCreate = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const payload = req.body;
        // (ควรมีการ Validation Payload)
        if (!payload.campaignId || !payload.sessionId || !payload.prefix || !payload.count || !payload.capacity) {
            return res.status(400).send({ message: "Missing required fields for bulk create" });
        }
        const newBags = yield bag_service_1.bagService.bulkCreate(payload);
        res.status(201).json(newBags);
    }
    catch (error) {
        res.status(500).send({ message: error.message });
    }
});
bagController.finalizeAndLink = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const payload = req.body;
        // (Validation)
        if (!payload.campaignId || !payload.bagId || !payload.scannedCodes || !Array.isArray(payload.scannedCodes)) {
            return res.status(400).send({ message: "Missing required fields for finalize" });
        }
        const result = yield bag_service_1.bagService.finalizeAndLink(payload);
        res.status(200).json(result);
    }
    catch (error) {
        console.error("Controller Error (Finalize & Link):", error);
        // (ส่ง Error Message ที่ Key Service ถอดรหัสไม่สำเร็จกลับไป)
        res.status(400).send({ message: error.message });
    }
});
bagController.getAllForCampaign = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const campaignId = req.params.campaignId;
        if (!campaignId) {
            return res.status(400).send({ message: "Missing Campaign ID" });
        }
        const bags = yield bag_service_1.bagService.getAllByCampaignId(campaignId);
        res.status(200).json(bags);
    }
    catch (error) {
        res.status(500).send({ message: error.message });
    }
});
bagController.deleteById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const bagId = req.params.bagId;
        if (!bagId) {
            return res.status(400).send({ message: "Missing Bag ID" });
        }
        const result = yield bag_service_1.bagService.deleteById(bagId);
        res.status(200).json(result);
    }
    catch (error) {
        res.status(500).send({ message: error.message });
    }
});
