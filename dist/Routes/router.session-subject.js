"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const session_subject_controller_1 = require("../Controller/session-subject.controller");
const sessionSubjectRouter = (0, express_1.Router)();
sessionSubjectRouter.post("/session-subjects", session_subject_controller_1.sessionSubjectController.create);
sessionSubjectRouter.delete("/session-subjects/:sessionId/:subjectId", session_subject_controller_1.sessionSubjectController.delete);
exports.default = sessionSubjectRouter;
