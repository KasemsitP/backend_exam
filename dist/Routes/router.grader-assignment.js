"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const grader_assignment_controller_1 = require("../Controller/grader-assignment.controller");
const graderAssignmentRouter = (0, express_1.Router)();
graderAssignmentRouter.post("/grader-assignments", grader_assignment_controller_1.graderAssignmentController.createBulk);
exports.default = graderAssignmentRouter;
