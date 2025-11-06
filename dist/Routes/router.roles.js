"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.roleRouter = void 0;
const express_1 = require("express");
const auth_controller_1 = require("../Controller/auth.controller");
const roleRouter = (0, express_1.Router)();
exports.roleRouter = roleRouter;
roleRouter.get("/roles/", auth_controller_1.authcontroller.getRoles);
