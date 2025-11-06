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
exports.userSessionsService = void 0;
const user_session_repo_1 = __importDefault(require("../Repo/user-session.repo"));
class userSessionsService {
}
exports.userSessionsService = userSessionsService;
_a = userSessionsService;
userSessionsService.findBySessionId = (sessionId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        return yield user_session_repo_1.default.findBySessionId(sessionId);
    }
    catch (error) {
        console.error("Service Error (findUserSessions):", error);
        throw error;
    }
});
