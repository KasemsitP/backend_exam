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
exports.gradingslotController = void 0;
const gradingslot_service_1 = require("../Service/gradingslot.service");
class gradingslotController {
}
exports.gradingslotController = gradingslotController;
_a = gradingslotController;
gradingslotController.CreateSlot = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { qrPayload, campaignId, graderId, questionNo } = req.body;
        if (!qrPayload || !campaignId || !graderId || !questionNo) {
            return res.status(400).send({ message: "ข้อมูลไม่ครบ" });
        }
        // 1) ถอด QR + หา booklet_subject_id ให้ตรงกับคนที่สอบใบนี้จริง ๆ
        // const decypted = await keyService.decryptQrPayload(qrPayload, parseInt(campaignId));
        // if (!decypted || !decypted.uid) {
        //   return res.status(400).send({ message: "QR Code ไม่ถูกต้อง หรือถอดรหัสล้มเหลว" });
        // }
        // console.log("Decrypted Payload:", decypted);
        const result = yield gradingslot_service_1.gradingService.createSlotFromQr({
            qrPayload,
            campaignId: Number(campaignId),
            graderId: Number(graderId),
            questionNo: Number(questionNo)
        });
        res.status(201).json(result);
        //   // 3) ส่งผลลัพธ์กลับไปให้ frontend
        //   res.status(201).json(result);
    }
    catch (error) {
        res.status(400).send({ message: error.message });
    }
});
gradingslotController.previewStartFromQr = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { qrPayload, campaignId, graderId, questionNo } = req.body;
        if (!qrPayload || !campaignId || !graderId || !questionNo) {
            return res.status(400).json({
                message: "ข้อมูลไม่ครบ",
            });
        }
        const result = yield gradingslot_service_1.gradingService.previewStartFromQr({
            qrPayload,
            campaignId: Number(campaignId),
            graderId: Number(graderId),
            questionNo: Number(questionNo),
        });
        return res.status(200).json(result);
    }
    catch (error) {
        return res.status(500).json({
            message: error.message || "ไม่สามารถ preview การเริ่มตรวจได้",
        });
    }
});
gradingslotController.confirmStartFromQr = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { qrPayload, campaignId, graderId, questionNo } = req.body;
        if (!qrPayload || !campaignId || !graderId || !questionNo) {
            return res.status(400).json({
                message: "ข้อมูลไม่ครบ",
            });
        }
        const result = yield gradingslot_service_1.gradingService.confirmStartFromQr({
            qrPayload,
            campaignId: Number(campaignId),
            graderId: Number(graderId),
            questionNo: Number(questionNo),
        });
        return res.status(200).json(result);
    }
    catch (error) {
        return res.status(500).json({
            message: error.message || "ไม่สามารถยืนยันเริ่มตรวจได้",
        });
    }
});
