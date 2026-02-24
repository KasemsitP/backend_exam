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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.campaignService = void 0;
const campaign_repo_1 = __importDefault(require("../Repo/campaign.repo"));
const session_repo_1 = __importDefault(require("../Repo/session.repo"));
const DB_1 = require("../model/DB");
class campaignService {
}
exports.campaignService = campaignService;
_a = campaignService;
campaignService.create = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const checkCampActive = yield campaign_repo_1.default.CheckActiveCamp();
    if (checkCampActive) {
        throw new Error("มีรอบสอบที่เปิดใช้งานอยู่แล้ว ไม่สามารถสร้างรอบสอบใหม่ได้");
    }
    console.log(payload);
    const newCampaign = yield campaign_repo_1.default.create(payload);
    return newCampaign;
});
campaignService.update = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const updatedCampaign = yield campaign_repo_1.default.update(payload);
    return updatedCampaign;
});
campaignService.delete = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const connection = yield DB_1.DB.getInstance().getConnection();
    try {
        yield connection.beginTransaction();
        yield session_repo_1.default.deleteByCampaignId(id, connection);
        const deleted = yield campaign_repo_1.default.delete(id, connection);
        yield connection.commit();
        if (!deleted) {
            throw new Error(`Failed to delete Campaign ID ${id} or not found.`);
        }
        return true;
    }
    catch (error) {
        yield connection.rollback();
        console.error("Service Error: Failed to delete campaign and sessions", error);
        throw error;
    }
    finally {
        connection.release();
    }
});
campaignService.getIsUnlock = (campaign_id) => __awaiter(void 0, void 0, void 0, function* () {
    return yield campaign_repo_1.default.getIsDecrypted(campaign_id);
});
