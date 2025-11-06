"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const verify_controller_1 = require("../Controller/verify.controller");
const verifyRouter = (0, express_1.Router)();
verifyRouter.post("/verify/qr-payload", verify_controller_1.verifyController.verify);
exports.default = verifyRouter;
