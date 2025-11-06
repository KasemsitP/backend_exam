"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAuthenticated = isAuthenticated;
function isAuthenticated(req, res, next) {
    if (req.session.userId) {
        next();
    }
    else {
        res.status(401).send({ message: "ไม่มีสิทธิ์ กรุณาเข้าสู่ระบบก่อน" });
    }
}
