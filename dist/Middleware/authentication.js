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
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAuthenticated = isAuthenticated;
const DB_1 = require("../model/DB");
function isAuthenticated(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        try {
            const userId = req.session.userId;
            if (!userId)
                return res.status(401).json({ message: "unauthenticated" });
            const conn = DB_1.DB.getInstance();
            const [rows] = yield conn.execute("SELECT id, active, session_version FROM accounts WHERE id = ? LIMIT 1", [userId]);
            // console.log(rows)
            const user = rows === null || rows === void 0 ? void 0 : rows[0];
            if (!user) {
                req.session.destroy(() => { });
                return res.status(401).json({ message: "unauthenticated" });
            }
            // ถูก revoke/disable
            if (Number(user.active) !== 1) {
                req.session.destroy(() => { });
                return res.status(403).json({ message: "account revoked/disabled" });
            }
            //  session เก่า (โดน bump session_version)
            const dbVer = Number((_a = user.session_version) !== null && _a !== void 0 ? _a : 1);
            const sessVer = Number((_b = req.session.sessionVersion) !== null && _b !== void 0 ? _b : 0);
            if (dbVer !== sessVer) {
                req.session.destroy(() => { });
                return res.status(401).json({ message: "session revoked" });
            }
            return next();
        }
        catch (err) {
            return res.status(500).json({ message: "isAuthenticated error" });
        }
    });
}
