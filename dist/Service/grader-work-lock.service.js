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
exports.GraderWorkLockSerivce = void 0;
const grader_work_lock_repo_1 = __importDefault(require("../Repo/grader-work-lock.repo"));
class GraderWorkLockSerivce {
}
exports.GraderWorkLockSerivce = GraderWorkLockSerivce;
_a = GraderWorkLockSerivce;
GraderWorkLockSerivce.getBagActiveGrader = (campaign_id) => __awaiter(void 0, void 0, void 0, function* () {
    return yield grader_work_lock_repo_1.default.findBagReportHeader(campaign_id);
});
