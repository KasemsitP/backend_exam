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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const worker_threads_1 = require("worker_threads");
const pdfkit_1 = __importDefault(require("pdfkit"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const DB_1 = require("../model/DB");
const grader_report_repo_1 = __importDefault(require("../Repo/grader-report.repo"));
const grading_report_repo_1 = require("../Repo/grading-report.repo");
// --- Helper Functions ---
function safeText(s) {
    return typeof s === "string" ? s : s == null ? "" : String(s);
}
// ฟังก์ชันสำหรับเตรียมข้อมูล (ยกมาจากตัว Service เดิม)
function fetchBagGradersReport(bagId, subjectId, conn) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const infoRow = yield grader_report_repo_1.default.getBagInfo(conn, bagId, subjectId);
        const questionCountD = yield grader_report_repo_1.default.getQuestionCountForBagSubject(conn, bagId, subjectId);
        const questionLabels = yield grader_report_repo_1.default.getQuestionLabels(conn, subjectId);
        const raw = yield grader_report_repo_1.default.getBookletGraderRows(conn, { bagId, subjectId });
        const result_is_unlock = yield (0, grading_report_repo_1.getUnlockCampaignByBagId)(conn, bagId);
        const unlock = (_b = (_a = result_is_unlock[0]) === null || _a === void 0 ? void 0 : _a.is_unlock) !== null && _b !== void 0 ? _b : 0;
        const questionCount = questionCountD !== null && questionCountD !== void 0 ? questionCountD : 0;
        const byBooklet = new Map();
        for (const r of raw) {
            const bookletId = Number(r.booklet_id);
            const user_code = unlock ? r.exam_code : r.random_num;
            const examCode = safeText(user_code);
            const qNo = Number(r.question_no);
            if (!byBooklet.has(bookletId)) {
                const questions = [];
                for (let i = 1; i <= questionCount; i++) {
                    questions.push({
                        questionNo: i,
                        grader1Name: null,
                        grader2Name: null,
                        grader1HasScore: false,
                        grader2HasScore: false
                    });
                }
                byBooklet.set(bookletId, { bookletId, examCode, questions });
            }
            const bk = byBooklet.get(bookletId);
            if (qNo > 0 && qNo <= questionCount) {
                const cell = bk.questions[qNo - 1];
                cell.grader1Name = r.grader1_name ? safeText(r.grader1_name) : null;
                cell.grader2Name = r.grader2_name ? safeText(r.grader2_name) : null;
                cell.grader1HasScore = r.grader1_score != null;
                cell.grader2HasScore = r.grader2_score != null;
            }
        }
        const booklets = Array.from(byBooklet.values()).sort((a, b) => a.examCode.localeCompare(b.examCode, undefined, { numeric: true }));
        return {
            bagId,
            subjectId,
            questionCount,
            questionLabels,
            booklets,
            unlock,
            info: {
                bag_no: Number(infoRow.bag_no),
                year_be: safeText(infoRow.year_be),
                site: safeText(infoRow.site),
                campaign_size: safeText(infoRow.campaign_size),
                campaign_name: infoRow.campaign_name ? safeText(infoRow.campaign_name) : null,
                subject_name: safeText(infoRow.subject_name),
            },
        };
    });
}
const FONT_NORMAL = path_1.default.resolve(__dirname, "../../fonts/THSarabunNew.ttf");
const FONT_BOLD = path_1.default.resolve(__dirname, "../../fonts/THSarabunNew-Bold.ttf");
// ฟังก์ชันสำหรับวาดหน้ากระดาษ PDF สำหรับรายงานผู้ตรวจ
function drawBagGraderMatrixPage(doc, report) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const { info, booklets, questionCount, questionLabels, unlock } = report;
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const { left, right, top, bottom } = doc.page.margins;
    const contentWidth = pageWidth - left - right;
    const labelMap = new Map(questionLabels.map((q) => [q.question_no, q.label]));
    const user_code_title = unlock === 1 ? "รหัสประจำตัวสอบ" : "ลำดับจัดเก็บ";
    // ====================== HEADER =======================
    let y = top;
    const headerY = y;
    doc.font(FONT_BOLD).fontSize(16).text("เอกสารรายชื่อผู้ตรวจรายข้อ", left, headerY, { width: contentWidth, align: "center" });
    doc.font(FONT_NORMAL).fontSize(30).text(`ถุงที่ ${info.bag_no}`, left, headerY, { width: contentWidth, align: "right" });
    y = headerY + 24;
    doc.font(FONT_NORMAL).fontSize(12).text(`${(_a = info.campaign_name) !== null && _a !== void 0 ? _a : "-"}  พ.ศ.${info.year_be} (${info.campaign_size})`, left, y, { width: contentWidth, align: "center" });
    y = doc.y + 2;
    doc.text(`ณ ${info.site}`, left, y, { width: contentWidth, align: "center" });
    y = doc.y + 6;
    doc.font(FONT_NORMAL).fontSize(13).text(`วิชา ${info.subject_name}`, left, y, { width: contentWidth, align: "center" });
    y = doc.y + 10;
    // ================= TABLE CONFIG ======================
    const totalRows = 30;
    const colCodeWidth = 60;
    const colsPerQuestion = 2;
    const colPerCellWidth = 58;
    const baseRowH1 = 34;
    const baseRowH2 = 14;
    const baseRowH = 16;
    const totalQuestionCols = questionCount * colsPerQuestion;
    const usedWidth = colCodeWidth + totalQuestionCols * colPerCellWidth;
    const widthScale = usedWidth > contentWidth ? contentWidth / usedWidth : 1;
    const availableHeight = pageHeight - bottom - y;
    const needHeight = (baseRowH1 + baseRowH2) + totalRows * baseRowH;
    const heightScale = needHeight > availableHeight ? availableHeight / needHeight : 1;
    const scale = Math.min(widthScale, heightScale, 1);
    const cwCode = colCodeWidth * scale;
    const cwCell = colPerCellWidth * scale;
    const rowH1 = baseRowH1 * scale;
    const rowH2 = baseRowH2 * scale;
    const rowH = baseRowH * scale;
    const fontHeader = Math.max(7, 10 * scale);
    const fontBody = Math.max(6, 9 * scale);
    const startX = left;
    // ================= TABLE HEADER ======================
    let x = startX;
    doc.lineWidth(0.5).strokeColor("black");
    doc.font(FONT_BOLD).fontSize(fontHeader);
    // ⚡ รวบเส้น Header
    let p = doc.rect(x, y, cwCode, rowH1 + rowH2);
    doc.text(user_code_title, x, y + 4 * scale, { width: cwCode, align: "center" });
    x += cwCode;
    for (let q = 1; q <= questionCount; q++) {
        const groupW = colsPerQuestion * cwCell;
        const label = (_b = labelMap.get(q)) !== null && _b !== void 0 ? _b : "";
        p = p.rect(x, y, groupW, rowH1);
        doc.text(`ข้อ ${q}\n${label}`, x, y + 2 * scale, { width: groupW, align: "center", ellipsis: true });
        x += groupW;
    }
    p.stroke();
    y += rowH1;
    x = startX + cwCode;
    const sub = ["ผู้ตรวจ 1", "ผู้ตรวจ 2"];
    p = doc.lineWidth(0.5); // เริ่ม path ใหม่
    for (let q = 1; q <= questionCount; q++) {
        for (let i = 0; i < 2; i++) {
            p = p.rect(x, y, cwCell, rowH2);
            doc.text(sub[i], x, y + 2 * scale, { width: cwCell, align: "center" });
            x += cwCell;
        }
    }
    p.stroke();
    y += rowH2;
    // ================= TABLE BODY ========================
    doc.font(FONT_NORMAL).fontSize(fontBody);
    for (let i = 0; i < totalRows; i++) {
        const bk = booklets[i];
        x = startX;
        // ⚡ รวบเส้นแนวนอน 1 บรรทัด
        let pathRow = doc.rect(x, y, cwCode, rowH);
        if (bk) {
            const textY = y + (rowH - fontBody) / 2;
            doc.text((_c = bk.examCode) !== null && _c !== void 0 ? _c : "", x + 2 * scale, textY, { width: cwCode - 4 * scale, align: "left", ellipsis: true });
        }
        x += cwCode;
        for (let q = 1; q <= questionCount; q++) {
            const cell = (_d = bk === null || bk === void 0 ? void 0 : bk.questions) === null || _d === void 0 ? void 0 : _d[q - 1];
            const g1 = (_f = (_e = cell === null || cell === void 0 ? void 0 : cell.grader1Name) === null || _e === void 0 ? void 0 : _e.split(" ")[0]) !== null && _f !== void 0 ? _f : "";
            const g2 = (_h = (_g = cell === null || cell === void 0 ? void 0 : cell.grader2Name) === null || _g === void 0 ? void 0 : _g.split(" ")[0]) !== null && _h !== void 0 ? _h : "";
            pathRow = pathRow.rect(x, y, cwCell, rowH);
            doc.text(g1, x, y + 2 * scale, { width: cwCell, align: "center", ellipsis: true });
            x += cwCell;
            pathRow = pathRow.rect(x, y, cwCell, rowH);
            doc.text(g2, x, y + 2 * scale, { width: cwCell, align: "center", ellipsis: true });
            x += cwCell;
        }
        pathRow.stroke(); // สั่งระบายทีเดียวต่อแถว
        y += rowH;
    }
}
// ---------------------------------------------------------
// Task 1: สร้าง PDF สำหรับ "1 ถุง" (Single Bag)
// ---------------------------------------------------------
function buildBagGraderPdf(options, writeStream) {
    return __awaiter(this, void 0, void 0, function* () {
        const { bagId } = options;
        const conn = yield DB_1.DB.getInstance().getConnection();
        try {
            const subjectId = yield grader_report_repo_1.default.getDerivedSubjectIdForBag(conn, bagId);
            const report = yield fetchBagGradersReport(bagId, subjectId, conn);
            const doc = new pdfkit_1.default({
                size: "A4", layout: "landscape", margins: { top: 40, bottom: 40, left: 40, right: 40 },
                autoFirstPage: true, bufferPages: false, // 🚀
            });
            doc.pipe(writeStream);
            drawBagGraderMatrixPage(doc, report);
            doc.end();
        }
        finally {
            conn.release();
        }
    });
}
// ---------------------------------------------------------
// Task 2: สร้าง PDF สำหรับ "ทุกถุงใน Campaign" (All Bags)
// ---------------------------------------------------------
function buildCampaignAllBagsGradersPdf(options, writeStream) {
    return __awaiter(this, void 0, void 0, function* () {
        const { campaignId } = options;
        const conn = yield DB_1.DB.getInstance().getConnection();
        try {
            const bags = yield grader_report_repo_1.default.getAllBags(conn, campaignId);
            if (!bags.length)
                throw new Error("ไม่พบถุงในแคมเปญนี้");
            const doc = new pdfkit_1.default({
                size: "A4", layout: "landscape", margins: { top: 40, bottom: 40, left: 40, right: 40 },
                autoFirstPage: false, bufferPages: false, // 🚀
            });
            doc.pipe(writeStream);
            for (let i = 0; i < bags.length; i++) {
                const b = bags[i];
                doc.addPage({ size: "A4", layout: "landscape", margins: { top: 40, bottom: 40, left: 40, right: 40 } });
                const subjectId = yield grader_report_repo_1.default.getDerivedSubjectIdForBag(conn, b.bag_id);
                const report = yield fetchBagGradersReport(b.bag_id, subjectId, conn);
                drawBagGraderMatrixPage(doc, report);
                if (i % 5 === 0)
                    yield new Promise(resolve => setTimeout(resolve, 0));
            }
            doc.end();
        }
        finally {
            conn.release();
        }
    });
}
// =========================================================
// Main Dispatcher
// =========================================================
function runTask() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { task, options } = worker_threads_1.workerData;
            const fileName = `grader_report_${task}_${Date.now()}_${Math.floor(Math.random() * 1000)}.pdf`;
            const filePath = path_1.default.join(os_1.default.tmpdir(), fileName);
            const writeStream = fs_1.default.createWriteStream(filePath);
            if (task === 'generateBagGraderPdf')
                yield buildBagGraderPdf(options, writeStream);
            else if (task === 'generateCampaignAllBagsGradersPdf')
                yield buildCampaignAllBagsGradersPdf(options, writeStream);
            writeStream.on('finish', () => { worker_threads_1.parentPort === null || worker_threads_1.parentPort === void 0 ? void 0 : worker_threads_1.parentPort.postMessage({ status: 'success', filePath }); });
            writeStream.on('error', (err) => { throw err; });
        }
        catch (error) {
            worker_threads_1.parentPort === null || worker_threads_1.parentPort === void 0 ? void 0 : worker_threads_1.parentPort.postMessage({ status: 'error', message: String(error) });
        }
    });
}
runTask();
