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
exports.userImportController = void 0;
const importuser_service_1 = require("../Service/importuser.service");
class userImportController {
}
exports.userImportController = userImportController;
_a = userImportController;
userImportController.importUsers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { rows } = req.body;
        const campaignId = parseInt(req.params.campaignId, 10);
        if (isNaN(campaignId)) {
            return res.status(400).send({ message: "Invalid Campaign ID" });
        }
        if (!Array.isArray(rows) || rows.length === 0) {
            return res.status(400).send({ message: "No rows to import" });
        }
        const stats = yield importuser_service_1.userImportService.importUsersToCampaign(campaignId, rows);
        res.status(201).json(stats);
    }
    catch (error) {
        console.error("Import Error (Controller):", error);
        res.status(500).send({ message: error.message });
    }
});
