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
exports.userservice = void 0;
const user_repo_1 = __importDefault(require("../Repo/user.repo"));
class userservice {
}
exports.userservice = userservice;
_a = userservice;
userservice.getUsersByCampaign = (req) => __awaiter(void 0, void 0, void 0, function* () {
    const { campaignCode = '', limit = '25', offset = '0' } = req.query;
    if (!campaignCode)
        throw new Error("กรุณาระบุ campaignCode");
    //console.log('[usersByCampaign] params =', { campaignCode, limit, offset});
    const result = yield user_repo_1.default.getUsersByCampaign(String(campaignCode));
    if (result.length === 0)
        throw new Error("ไม่พบข้อมูล");
    return result;
});
userservice.getCountUserCampaign = (campaign_id) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield user_repo_1.default.getCountUserCampaign(Number(String(campaign_id)));
    return result;
});
