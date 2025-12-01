"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const gradingscore_controller_1 = require("../Controller/gradingscore.controller");
const gradingslotRouter = (0, express_1.Router)();
gradingslotRouter.post("/gradingscore/submit", gradingscore_controller_1.gradingscoreController.SubmitScore);
gradingslotRouter.get("/gradingscore/record/:graderId", gradingscore_controller_1.gradingscoreController.FetchRecord);
exports.default = gradingslotRouter;
