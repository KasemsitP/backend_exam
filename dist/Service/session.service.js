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
exports.sessionService = void 0;
const session_repo_1 = __importDefault(require("../Repo/session.repo"));
class sessionService {
}
exports.sessionService = sessionService;
_a = sessionService;
sessionService.create = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const newSession = yield session_repo_1.default.create(payload);
    return newSession;
});
sessionService.delete = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield session_repo_1.default.delete(id);
    console.log("lnwwwadawdwad");
    if (!result) {
        throw new Error(`Failed to delete Session ID ${id} or not found.`);
    }
    return true;
});
