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
/**
 * [ GET (เหมือนเดิม) ]
 */
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
/**
 * [ ⭐️ POST (แก้ไข) ⭐️ ]
 * (keyAlias -> key)
 */
keyController.create = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { campaignId, key } = req.body; // [ ⭐️ FIX ⭐️ ]
        if (!campaignId || !key) { // [ ⭐️ FIX ⭐️ ]
            return res
                .status(400)
                .send({ message: "Missing campaignId or key" }); // [ ⭐️ FIX ⭐️ ]
        }
        const keyData = yield key_service_1.keyService.create(campaignId, key); // [ ⭐️ FIX ⭐️ ]
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
        const keyId = parseInt(req.params.id, 10);
        if (isNaN(keyId)) {
            return res.status(400).send({ message: "Invalid Key ID" });
        }
        yield key_service_1.keyService.delete(keyId);
        res.status(204).send();
    }
    catch (error) {
        res.status(500).send({ message: error.message });
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
/**
 * [ ⭐️ POST (แก้ไข) ⭐️ ]
 * @desc POST /api/keys/encrypt-session-bulk
 */
keyController.runBulkEncryption = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // ( 1. รับแค่ campaignId, sessionId )
        const { campaignId, sessionId } = req.body;
        if (!campaignId || !sessionId) {
            return res
                .status(400)
                .send({ message: "Missing campaignId or sessionId" });
        }
        // 2. ส่งต่อให้ Service (สมอง)
        const stats = yield key_service_1.keyService.runBulkEncryptionForSession(campaignId, sessionId);
        // 3. ส่งผลลัพธ์ (Stats) กลับไป
        res.status(200).json(stats); // (เช่น { usersEncrypted: 150 })
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
        const decrypted = yield key_service_1.keyService.decryptQrPayload(ciphertext, campaignId);
        res.status(200).json(decrypted);
    }
    catch (error) {
        res.status(500).send({ message: error.message });
    }
});
