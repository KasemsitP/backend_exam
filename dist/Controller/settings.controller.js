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
exports.SettingsController = void 0;
const settings_service_1 = require("../Service/settings.service");
class SettingsController {
}
exports.SettingsController = SettingsController;
_a = SettingsController;
SettingsController.updateActiveCamp = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { campaign_id } = req.params;
        if (!campaign_id) {
            return res.status(400).send({ success: false, message: "ไม่พบรหัสรอบสอบ" });
        }
        const result = yield settings_service_1.SettingService.ActiveInActiveCampaign(Number(campaign_id));
        console.log(result);
        res.status(200).json({ success: true, message: "รอบสอบถูกเปิดหรือปิดการใช้งานแล้ว" });
    }
    catch (error) {
        console.error("ไม่สามารถเปิดใช้รอบสอบได้", error);
        res.status(400).send({ success: false, message: error.message });
    }
});
SettingsController.updateActiveKeys = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { campaign_id } = req.params;
        if (!campaign_id) {
            return res.status(400).send({ success: false, message: "ไม่พบรหัสรอบสอบ" });
        }
        const result = yield settings_service_1.SettingService.ActiveInActiveQR(Number(campaign_id));
        console.log(result);
        res.status(200).json({ success: true, message: "คิวอาร์โค้ดที่เปิดหรือปิดการใช้งานแล้ว" });
    }
    catch (error) {
        console.error("ไม่สามารถเปิดใช้รอบสอบได้", error);
        res.status(400).send({ success: false, message: error.message });
    }
});
SettingsController.getSettingStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { campaign_id } = req.params;
        if (!campaign_id) {
            return res.status(400).send({ success: false, message: "ไม่พบรหัสรอบสอบ" });
        }
        const result = yield settings_service_1.SettingService.getSettingStatus(Number(campaign_id));
        console.log(result);
        res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        console.error("ไม่สามารถเปิดใช้รอบสอบได้", error);
        res.status(400).send({ success: false, message: error.message });
    }
});
