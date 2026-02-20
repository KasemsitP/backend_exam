"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GradingReportController = void 0;
const grading_report_service_1 = require("../Service/grading-report.service");
const grader_report_service_1 = require("../Service/grader-report.service");
function asInt(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
}
function parseBool01(v, fallback) {
    if (v === undefined || v === null)
        return fallback;
    const s = String(v).trim().toLowerCase();
    if (s === "1" || s === "true" || s === "yes")
        return true;
    if (s === "0" || s === "false" || s === "no")
        return false;
    return fallback;
}
//type GroupRule = { title: string; items: AnyGroupItem[] };
function normalizeGroups(input) {
    if (!Array.isArray(input))
        return [];
    return input
        .map((g) => {
        var _b;
        const title = String((_b = g === null || g === void 0 ? void 0 : g.title) !== null && _b !== void 0 ? _b : "").trim() || "กลุ่ม";
        const rawItems = Array.isArray(g === null || g === void 0 ? void 0 : g.items) ? g.items : [];
        const items = rawItems
            .map((it) => {
            var _b, _c, _d;
            const sessionId = asInt((_b = it === null || it === void 0 ? void 0 : it.sessionId) !== null && _b !== void 0 ? _b : it === null || it === void 0 ? void 0 : it.session_id, 0);
            const subjectId = asInt((_c = it === null || it === void 0 ? void 0 : it.subjectId) !== null && _c !== void 0 ? _c : it === null || it === void 0 ? void 0 : it.subject_id, 0);
            const questionNo = asInt((_d = it === null || it === void 0 ? void 0 : it.questionNo) !== null && _d !== void 0 ? _d : it === null || it === void 0 ? void 0 : it.question_no, 0);
            return { sessionId, subjectId, questionNo };
        })
            .filter((x) => x.sessionId > 0 && x.subjectId > 0 && x.questionNo > 0);
        return { title, items };
    })
        .filter((g) => g.items.length > 0);
}
class GradingReportController {
    /**
     * GET /api/reports/bags/:bagId/subjects/:subjectId/scores
     */
    static getBagSubjectScores(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _b;
            try {
                const bagId = Number(req.params.bagId);
                // const subjectId = Number(req.params.subjectId);
                if (Number.isNaN(bagId)) { //|| Number.isNaN(subjectId
                    return res.status(400).json({ message: "Invalid bagId or subjectId" });
                }
                const result = yield grading_report_service_1.GradingReportService.getBagScoresReport(bagId);
                res.json(result);
            }
            catch (err) {
                console.error("Controller Error (getBagSubjectScores):", err);
                res
                    .status(500)
                    .json({ message: (_b = err === null || err === void 0 ? void 0 : err.message) !== null && _b !== void 0 ? _b : "Internal server error" });
            }
        });
    }
    static exportPassListPdf(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const campaignId = asInt(req.params.campaignId, 0);
                if (!campaignId) {
                    return res.status(400).json({ message: "campaignId ไม่ถูกต้อง" });
                }
                const sort = String(req.query.sort || "score"); // score | examCode | name
                const order = String(req.query.order || "desc"); // asc | desc
                const includeScore = String(req.query.includeScore || "0") === "1";
                const pdfBuffer = yield grading_report_service_1.GradingReportService.generatePassListPdf({
                    campaignId,
                    sort,
                    order,
                    includeScore,
                });
                res.setHeader("Content-Type", "application/pdf");
                res.setHeader("Content-Disposition", `inline; filename="pass-list-campaign-${campaignId}.pdf"`);
                return res.status(200).send(pdfBuffer);
            }
            catch (err) {
                console.error(err);
                return res
                    .status(500)
                    .json({ message: (err === null || err === void 0 ? void 0 : err.message) || "Export PDF ไม่สำเร็จ" });
            }
        });
    }
    static exportRankingPdf(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const campaignId = asInt(req.params.campaignId, 0);
                if (!campaignId)
                    return res.status(400).json({ message: "campaignId ไม่ถูกต้อง" });
                const subjectIds = String(req.query.subjectIds || "")
                    .split(",")
                    .map((x) => Number(x.trim()))
                    .filter((n) => Number.isFinite(n) && n > 0);
                if (subjectIds.length === 0) {
                    return res.status(400).json({ message: "กรุณาส่ง subjectIds อย่างน้อย 1 รายการ" });
                }
                const sortBy = String(req.query.sortBy || "TOTAL_DESC");
                const includeRankNo = parseBool01(req.query.includeRankNo, true);
                const includeRoomSeat = parseBool01(req.query.includeRoomSeat, true);
                const includeAvgExplain = parseBool01(req.query.includeAvgExplain, true);
                const onlyCompleted = parseBool01(req.query.onlyCompleted, false);
                const limit = Math.min(Math.max(asInt(req.query.limit, 0), 0), 5000); // 0 = ไม่จำกัด
                let groups = [];
                const groupsRaw = req.query.groups;
                if (groupsRaw) {
                    try {
                        groups = JSON.parse(String(groupsRaw));
                        if (!Array.isArray(groups))
                            groups = [];
                    }
                    catch (_b) {
                        return res.status(400).json({ message: "groups JSON ไม่ถูกต้อง" });
                    }
                }
                const pdf = yield grading_report_service_1.GradingReportService.generateRankingPdf({
                    campaignId,
                    subjectIds,
                    sortBy,
                    includeRankNo,
                    includeRoomSeat,
                    includeAvgExplain,
                    onlyCompleted,
                    limit,
                    groups: normalizeGroups(groups),
                });
                res.setHeader("Content-Type", "application/pdf");
                res.setHeader("Content-Disposition", `inline; filename="ranking-${campaignId}.pdf"`);
                return res.status(200).send(pdf);
            }
            catch (err) {
                console.error(err);
                return res.status(500).json({ message: (err === null || err === void 0 ? void 0 : err.message) || "Export ranking PDF ไม่สำเร็จ" });
            }
        });
    }
    // ✅ POST version (body)
    static exportRankingPdfPost(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _b, _c, _d, _e, _f, _g, _h, _j;
            try {
                const campaignId = asInt(req.params.campaignId, 0);
                if (!campaignId)
                    return res.status(400).json({ message: "campaignId ไม่ถูกต้อง" });
                const subjectIds = Array.isArray((_b = req.body) === null || _b === void 0 ? void 0 : _b.subjectIds)
                    ? req.body.subjectIds.map((x) => asInt(x, 0)).filter((n) => n > 0)
                    : [];
                if (subjectIds.length === 0) {
                    return res.status(400).json({ message: "กรุณาส่ง subjectIds อย่างน้อย 1 รายการ" });
                }
                const sortBy = String(((_c = req.body) === null || _c === void 0 ? void 0 : _c.sortBy) || "TOTAL_DESC");
                const includeRankNo = !!((_d = req.body) === null || _d === void 0 ? void 0 : _d.includeRankNo);
                const includeRoomSeat = !!((_e = req.body) === null || _e === void 0 ? void 0 : _e.includeRoomSeat);
                const includeAvgExplain = !!((_f = req.body) === null || _f === void 0 ? void 0 : _f.includeAvgExplain);
                const onlyCompleted = !!((_g = req.body) === null || _g === void 0 ? void 0 : _g.onlyCompleted);
                const limit = Math.min(Math.max(asInt((_h = req.body) === null || _h === void 0 ? void 0 : _h.limit, 0), 0), 5000);
                const groups = normalizeGroups((_j = req.body) === null || _j === void 0 ? void 0 : _j.groups);
                const pdf = yield grading_report_service_1.GradingReportService.generateRankingPdf({
                    campaignId,
                    subjectIds,
                    sortBy,
                    includeRankNo,
                    includeRoomSeat,
                    includeAvgExplain,
                    onlyCompleted,
                    limit,
                    groups,
                });
                res.setHeader("Content-Type", "application/pdf");
                res.setHeader("Content-Disposition", `inline; filename="ranking-${campaignId}.pdf"`);
                return res.status(200).send(pdf);
            }
            catch (err) {
                console.error(err);
                return res.status(500).json({ message: (err === null || err === void 0 ? void 0 : err.message) || "Export ranking PDF ไม่สำเร็จ" });
            }
        });
    }
    static exportBagGradersPdf(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _b;
            try {
                const bagId = Number(req.params.bagId);
                console.log("exportBagGradersPdf - bagId:", bagId);
                if (!bagId)
                    return res.status(400).json({ message: "bagId/subjectId ไม่ถูกต้อง" });
                const pdf = yield grader_report_service_1.GraderReportService.generateBagGraderPdf(bagId);
                res.setHeader("Content-Type", "application/pdf");
                res.setHeader("Content-Disposition", `inline; filename="bag-${bagId}-graders.pdf"`);
                return res.status(200).send(pdf);
            }
            catch (e) {
                console.error(e);
                return res.status(500).json({ message: (_b = e === null || e === void 0 ? void 0 : e.message) !== null && _b !== void 0 ? _b : "export pdf failed" });
            }
        });
    }
    static exportCampaignAllBagsGradersPdf(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const campaignId = asInt(req.params.campaignId, 0);
                if (!campaignId) {
                    return res.status(400).json({ message: "campaignId ไม่ถูกต้อง" });
                }
                console.log(`Generating Grader Report for Campaign: ${campaignId}`);
                // Call the optimized service method
                const pdf = yield grader_report_service_1.GraderReportService.generateCampaignAllBagsGradersPdf(campaignId);
                res.setHeader("Content-Type", "application/pdf");
                res.setHeader("Content-Disposition", `inline; filename="campaign-${campaignId}-allbags-graders.pdf"`);
                return res.status(200).send(pdf);
            }
            catch (err) {
                console.error("exportCampaignAllBagsGradersPdf Error:", err);
                return res.status(500).json({ message: (err === null || err === void 0 ? void 0 : err.message) || "Export PDF ไม่สำเร็จ" });
            }
        });
    }
}
exports.GradingReportController = GradingReportController;
_a = GradingReportController;
GradingReportController.ReportScorePDF = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const bagId = Number(req.params.bagId);
    try {
        const buf = yield grading_report_service_1.GradingReportService.generateBagScorePdf(bagId);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="bag-${bagId}-scores.pdf"`);
        res.send(buf);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "สร้าง PDF ไม่สำเร็จ" });
    }
});
GradingReportController.ReportScoreAllPDF = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { campaign_id } = req.params;
    // console.log(campaign_id)
    try {
        const buf = yield grading_report_service_1.GradingReportService.generateCampaignBagScoresPdf(Number(campaign_id));
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="campaign-${campaign_id}-scores.pdf"`);
        res.send(buf);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "สร้าง PDF ไม่สำเร็จ" });
    }
});
GradingReportController.ReportScoreGraders = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { bag_id, grader_id } = req.params;
    // console.log(campaign_id)
    try {
        const bagId = Number(bag_id);
        const graderId = Number(grader_id);
        console.log(bagId, graderId);
        // ดึงชื่อผู้ตรวจจากฐานข้อมูลเอง
        const graderName = req.query.graderName || "................................";
        const pdfBuffer = yield grading_report_service_1.GradingReportService.generateGraderBagSummaryPdf(bagId, graderId, graderName);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="grader-summary-bag-${bagId}-grader-${graderId}.pdf"`);
        res.send(pdfBuffer);
    }
    catch (err) {
        res.status(500).json({ message: "สร้าง PDF คะแนนผู้ตรวจไม่สำเร็จ" });
    }
});
