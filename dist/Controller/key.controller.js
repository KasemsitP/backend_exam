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
exports.keyController = void 0;
const key_service_1 = require("../Service/key.service");
class keyController {
}
exports.keyController = keyController;
_a = keyController;
keyController.getAllForCampaign = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const campaignId = parseInt(req.params.campaignId, 10);
        if (isNaN(campaignId)) {
            return res.status(400).send({ message: "Invalid Campaign ID" });
        }
        const keys = yield key_service_1.keyService.getAllForCampaign(campaignId);
        res.status(200).json(keys);
    }
    catch (error) {
        res.status(500).send({ message: error.message });
    }
});
keyController.getAllForCampaignManager = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const campaignId = parseInt(req.params.campaignId, 10);
        const AccountId = parseInt(req.params.AccountId, 10);
        if (isNaN(campaignId) || isNaN(AccountId)) {
            return res.status(400).send({ message: "Invalid Campaign ID  or Accoun ID" });
        }
        const keys = yield key_service_1.keyService.getAllForCampaignManager(campaignId, AccountId);
        res.status(200).json(keys);
    }
    catch (error) {
        res.status(500).send({ message: error.message });
    }
});
/**
 * (keyAlias -> key)
 */
keyController.create = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { campaignId, key, account_id, order_num } = req.body;
        if (!campaignId || !key || !account_id || !order_num) {
            return res
                .status(400)
                .send({ message: "Missing campaignId or key or order_num" });
        }
        const keyData = yield key_service_1.keyService.create(campaignId, key, account_id, order_num);
        res.status(201).json(keyData);
    }
    catch (error) {
        if (error.message.includes("Key limit")) {
            return res.status(409).send({ message: error.message });
        }
        res.status(500).send({ message: error.message });
    }
});
/**
 * [ DELETE (เหมือนเดิม) ]
 */
keyController.delete = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const keyId = parseInt(req.params.keyId, 10);
        const campaignId = parseInt(req.params.campaignId, 10);
        const accountId = parseInt(req.params.accountId, 10);
        console.log("keyId:", keyId, "campaignId:", campaignId, "accountId:", accountId);
        if (isNaN(keyId) || isNaN(campaignId) || isNaN(accountId)) {
            return res.status(400).send({ message: "Invalid Key ID, Campaign ID, or Account ID" });
        }
        yield key_service_1.keyService.delete(keyId, campaignId, accountId);
        res.status(204).send({ message: "ลบคีย์สำเร็จแล้ว" });
    }
    catch (error) {
        res.status(500).send({ message: error.message });
        // console.log("Error in delete controller:", error);
    }
});
keyController.getForgetKeys = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { campaignId, keyId, accountId, password } = req.body;
        if (!campaignId || !keyId || !accountId || !password) {
            return res.status(400).send({ message: "ข้อมูลไม่ถูกต้อง" });
        }
        const result = yield key_service_1.keyService.delete(keyId, campaignId, accountId);
        res.status(204).send({ success: true, message: "กู้คีย์สำเร็จแล้ว", data: result });
    }
    catch (error) {
        res.status(500).send({ message: error.message });
        // console.log("Error in delete controller:", error);
    }
});
keyController.getPrerequisites = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const campaignId = parseInt(req.params.campaignId, 10);
        if (isNaN(campaignId)) {
            return res.status(400).send({ message: "Invalid Campaign ID" });
        }
        const status = yield key_service_1.keyService.getPrerequisites(campaignId);
        res.status(200).json(status);
    }
    catch (error) {
        res.status(500).send({ message: error.message });
    }
});
keyController.runBulkEncryption = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // ( 1. รับแค่ campaignId, sessionId )
        const { campaignId } = req.body;
        console.log(campaignId);
        if (!campaignId) {
            return res
                .status(400)
                .send({ message: "Missing campaignId or sessionId" });
        }
        const stats = yield key_service_1.keyService.runBulkEncryptionForSession(campaignId);
        res.status(200).json(stats);
    }
    catch (error) {
        if (error.message.includes("Key") ||
            error.message.includes("User session")) {
            return res.status(400).send({ message: error.message });
        }
        res.status(500).send({ message: error.message });
    }
});
keyController.testDecrypt = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { ciphertext, campaignId } = req.body;
        if (!ciphertext || !campaignId) {
            return res.status(400).send({ message: "Missing ciphertext or campaignId" });
        }
        const decrypted = yield key_service_1.keyService.decryptPayloadStaff(ciphertext, campaignId);
        res.status(200).json(decrypted);
    }
    catch (error) {
        res.status(500).send({ message: error.message });
    }
});
keyController.getDashboard = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const campaignId = Number(req.params.campaignId);
        if (Number.isNaN(campaignId)) {
            return res.status(400).json({ message: "invalid campaign id" });
        }
        const data = yield key_service_1.keyService.GetDashBoard(campaignId);
        return res.json(data);
    }
    catch (err) {
        console.error("getDashboard error:", err);
        return res.status(500).json({ message: "Internal server error" });
    }
});
keyController.forgetKey = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log("forgetKey controller called with body:", req.body);
    try {
        const { campaignId, keyId, accountId, password } = req.body;
        if (!campaignId || !keyId || !accountId || !password) {
            return res.status(400).send({ message: "ข้อมูลไม่ถูกต้อง" });
        }
        const result = yield key_service_1.keyService.getForgetKey(campaignId, keyId, accountId, password);
        console.log("Forget Key Result:", result);
        res.status(200).send({ success: true, message: "กู้คีย์สำเร็จแล้ว", data: result });
    }
    catch (error) {
        res.status(500).send({ message: error.message });
        console.log("Error  controller:", error);
    }
});
keyController.TestMask = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { payload } = req.body;
        if (!payload) {
            return res.status(400).send({ message: "Missing payload" });
        }
        const result = yield key_service_1.keyService.maskQrPayload(payload);
        res.status(200).send({ success: true, message: "กู้คีย์สำเร็จแล้ว", data: result });
    }
    catch (error) {
        res.status(500).send({ message: error.message });
        console.log("Error  controller:", error);
    }
});
