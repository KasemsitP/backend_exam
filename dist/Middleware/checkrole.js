"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkRole = checkRole;
function checkRole(requiredRole) {
    return (req, res, next) => {
        var _a;
        const userRole = (_a = req.session.roles) === null || _a === void 0 ? void 0 : _a[0];
        if (!userRole) {
            return res.status(401).send({ message: "ไม่มีสิทธิ์" });
        }
        if (userRole !== requiredRole) {
            return res.status(403).send({ message: "ไม่อนุญาต: สิทธิ์ไม่เพียงพอ" });
        }
        next();
    };
}
