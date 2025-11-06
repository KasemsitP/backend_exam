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
        if (!payload.qrPayload || !payload.campaignId || !payload.sessionId) {
            return res.status(400).send({ message: "Missing required fields" });
        }
        const userSessionData = yield verify_service_1.verifyService.verifyQrPayload(payload);
        res.status(200).json(userSessionData);
    }
    catch (error) {
        console.error("Controller Error (Verify):", error);
        // (ส่ง Error Message ที่ Service (เช่น "QR Code นี้สำหรับ Session อื่น") กลับไป)
        res.status(400).send({ message: error.message });
    }
});
