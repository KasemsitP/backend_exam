"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const user_session_controller_1 = require("../Controller/user-session.controller");
const router = (0, express_1.Router)();
router.get("/user-sessions/session/:sessionId", user_session_controller_1.userSessionsController.findBySessionId);
exports.default = router;
