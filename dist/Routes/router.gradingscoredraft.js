"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const gradingscoredraft_controller_1 = __importDefault(require("../Controller/gradingscoredraft.controller"));
const router = (0, express_1.Router)();
router.post("/gradingdraft/save", gradingscoredraft_controller_1.default.saveDraftScore);
router.get("/gradingdraft/bag/:bagId", gradingscoredraft_controller_1.default.getDraftsByBagId);
router.get("/gradingdraft/unconfirmed/:graderId", gradingscoredraft_controller_1.default.getDraftsUnconfirmed);
router.post("/gradingdraft/confirm-bag", gradingscoredraft_controller_1.default.confirmBagScores);
router.post("/gradingdraft/cancel", gradingscoredraft_controller_1.default.cancelDraftScore);
exports.default = router;
