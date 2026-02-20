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
exports.SignSheetController = void 0;
const signsheet_service_1 = require("../Service/signsheet.service");
class SignSheetController {
}
exports.SignSheetController = SignSheetController;
_a = SignSheetController;
SignSheetController.createPDF = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _b, _c, _d;
    try {
        const { session_id, campaign_id } = req.params;
        if (!session_id || !campaign_id) {
            return res
                .status(400)
                .json({ message: "Invalid Campaign ID and session_id" });
        }
        const course = String((_b = req.query.course) !== null && _b !== void 0 ? _b : "วิชาไม่ระบุ");
        const org = String((_c = req.query.org) !== null && _c !== void 0 ? _c : "");
        const sessionText = String((_d = req.query.sessionText) !== null && _d !== void 0 ? _d : "");
        const pdfBuffer = yield signsheet_service_1.SignSheetService.generateSignSheetPdf({
            campaign_id: Number(campaign_id),
            session_id: Number(session_id),
            course,
            org,
            sessionText,
        });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="signsheet_${campaign_id}_${session_id}.pdf"`);
        res.send(pdfBuffer);
    }
    catch (err) {
        console.error("generate sign sheet pdf error:", err);
        res.status(500).json({ message: "ไม่สามารถสร้าง PDF ได้" });
    }
});
//  สำหรับหน้าเว็บ (pagination)
SignSheetController.listPaginated = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _b, _c, _d;
    try {
        const { session_id, campaign_id } = req.params;
        if (!session_id || !campaign_id) {
            return res
                .status(400)
                .json({ message: "Invalid Campaign ID and session_id" });
        }
        // query string: page, limit, search
        const page = parseInt(String((_b = req.query.page) !== null && _b !== void 0 ? _b : "1"), 10);
        const limit = parseInt(String((_c = req.query.limit) !== null && _c !== void 0 ? _c : "10"), 10);
        const search = String((_d = req.query.search) !== null && _d !== void 0 ? _d : "");
        const result = yield signsheet_service_1.SignSheetService.getPaginatedUserSessions({
            session_id: Number(session_id),
            campaign_id: Number(campaign_id),
            page,
            limit,
            search,
        });
        // result = { data, meta } จาก repo
        res.json(result);
    }
    catch (err) {
        console.error("listPaginated error:", err);
        res.status(500).json({ message: "ไม่สามารถดึงข้อมูลผู้เข้าสอบได้" });
    }
});
