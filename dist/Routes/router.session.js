"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const session_controller_1 = require("../Controller/session.controller");
const sessionRouter = (0, express_1.Router)();
sessionRouter.post("/sessions", session_controller_1.sessionController.create);
sessionRouter.put("/sessions/:id", session_controller_1.sessionController.update);
sessionRouter.delete("/sessions/:id", session_controller_1.sessionController.delete);
exports.default = sessionRouter;
