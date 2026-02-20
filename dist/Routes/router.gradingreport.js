"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const grading_report_controller_1 = require("../Controller/grading-report.controller");
const reportRouter = (0, express_1.Router)();
reportRouter.get("/reports/bags/:bagId/scores", grading_report_controller_1.GradingReportController.getBagSubjectScores);
reportRouter.get("/reports/bags/:bagId/scores/pdf", grading_report_controller_1.GradingReportController.ReportScorePDF);
reportRouter.get("/reports/campaigns/:campaign_id/scoreall/pdf", grading_report_controller_1.GradingReportController.ReportScoreAllPDF);
reportRouter.get("/reports/bags/:bag_id/graders/:grader_id/summary-pdf", grading_report_controller_1.GradingReportController.ReportScoreGraders);
reportRouter.get("/reports/campaigns/:campaignId/pass-list", grading_report_controller_1.GradingReportController.exportPassListPdf);
reportRouter.get("/campaigns/:campaignId/ranking/pdf", grading_report_controller_1.GradingReportController.exportRankingPdf);
// POST (แนะนำ)
reportRouter.post("/campaigns/:campaignId/ranking/pdf", grading_report_controller_1.GradingReportController.exportRankingPdfPost);
reportRouter.get("/reports/campaigns/:bagId/score/pdf", grading_report_controller_1.GradingReportController.exportBagGradersPdf);
reportRouter.get("/reports/campaigns/:campaignId/bags/graders/pdf", grading_report_controller_1.GradingReportController.exportCampaignAllBagsGradersPdf);
exports.default = reportRouter;
