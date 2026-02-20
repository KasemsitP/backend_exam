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
exports.verifyController = void 0;
const verify_service_1 = require("../Service/verify.service");
class verifyController {
}
exports.verifyController = verifyController;
_a = verifyController;
verifyController.verify = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const payload = req.body;
        if (!payload.qrPayload) {
            return res.status(400).send({ success: false, message: "Missing required fields" });
        }
        const userSessionData = yield verify_service_1.verifyService.verifyQrPayload(payload);
        console.log(userSessionData);
        res.status(200).json(userSessionData);
    }
    catch (error) {
        console.error("Controller Error (Verify):", error);
        // (ส่ง Error Message ที่ Service (เช่น "QR Code นี้สำหรับ Session อื่น") กลับไป)
        res.status(400).send({ success: false, message: error.message });
    }
});
verifyController.CheckBookletsOrders = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { campaignId, qrPayload, innitialCode } = req.body;
        const bookletsId = parseInt(innitialCode);
        if (!qrPayload || !campaignId || !bookletsId) {
            return res.status(400).send({ success: false, message: "ข้อมูลไม่ครบถ้วน" });
        }
        const userSessionData = yield verify_service_1.verifyService.checkBookletsOrders(campaignId, qrPayload, bookletsId);
        res.status(200).json(userSessionData);
    }
    catch (error) {
        console.error("Controller Error (Verify):", error);
        // (ส่ง Error Message ที่ Service (เช่น "QR Code นี้สำหรับ Session อื่น") กลับไป)
        res.status(400).send({ success: false, message: error.message });
    }
});
