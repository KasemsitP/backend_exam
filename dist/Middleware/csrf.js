"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.doubleCsrfProtection = exports.generateCsrfToken = void 0;
const csrf_csrf_1 = require("csrf-csrf");
_a = (0, csrf_csrf_1.doubleCsrf)({
    getSecret: () => process.env.csrf_secret,
    getSessionIdentifier: (req) => req.sessionID,
    cookieName: "csrf-token",
    cookieOptions: {
        sameSite: "lax",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        path: "/",
    },
    size: 64,
}), exports.generateCsrfToken = _a.generateCsrfToken, exports.doubleCsrfProtection = _a.doubleCsrfProtection;
