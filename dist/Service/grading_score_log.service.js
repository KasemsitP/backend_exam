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
exports.gradingScoreLogService = void 0;
const grading_score_log_1 = __importDefault(require("../Repo/grading_score_log"));
class gradingScoreLogService {
}
exports.gradingScoreLogService = gradingScoreLogService;
_a = gradingScoreLogService;
gradingScoreLogService.getScoreLogByBagId = (bagId) => __awaiter(void 0, void 0, void 0, function* () {
    return yield grading_score_log_1.default.getScoreLogByBagId(bagId);
});
