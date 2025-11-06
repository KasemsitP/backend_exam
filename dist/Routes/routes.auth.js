"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_controller_1 = require("../Controller/auth.controller");
const router = express_1.default.Router();
router.post("/register", auth_controller_1.authcontroller.register);
router.post("/login", auth_controller_1.authcontroller.login);
router.delete("/logout", auth_controller_1.authcontroller.logout);
router.get("/me", auth_controller_1.authcontroller.getMe);
exports.default = router;
