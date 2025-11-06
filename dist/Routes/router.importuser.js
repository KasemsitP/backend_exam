"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const importuser_controller_1 = require("../Controller/importuser.controller");
// import { isAuth, isAdmin } from "../middleware/auth.middleware";
const userImportRouter = (0, express_1.Router)();
userImportRouter.post("/import/campaign/:campaignId", 
// isAuth,
// isAdmin,
importuser_controller_1.userImportController.importUsers);
exports.default = userImportRouter;
