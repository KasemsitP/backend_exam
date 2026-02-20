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
exports.decryptedController = void 0;
const decrypt_service_1 = require("../Service/decrypt.service");
class decryptedController {
}
exports.decryptedController = decryptedController;
_a = decryptedController;
decryptedController.decryptedUnlock = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { campaignId } = req.params;
        const { FirstKey, SecondKey } = req.body;
        if (!campaignId) {
            return res.status(400).send({ message: "ไม่พบ campaign_id" });
        }
        const result_decrypt = yield decrypt_service_1.CampaignDecryptService.decryptedUnlock(Number(campaignId), FirstKey, SecondKey);
        res.status(201).json(result_decrypt);
    }
    catch (error) {
        res.status(400).send({ message: error.message });
    }
});
