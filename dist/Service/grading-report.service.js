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
exports.GradingReportService = void 0;
exports.buildQuestionRows = buildQuestionRows;
const DB_1 = require("../model/DB");
const grading_report_repo_1 = require("../Repo/grading-report.repo");
const passlist_repo_1 = __importDefault(require("../Repo/passlist.repo"));
const ranking_report_repo_1 = __importDefault(require("../Repo/ranking-report.repo"));
const grading_report_repo_2 = require("../Repo/grading-report.repo");
const pdfkit_1 = __importDefault(require("pdfkit"));
const path_1 = __importDefault(require("path"));
// Helper สร้าง Key สำหรับ Map
function keyOf(sessionId, subjectId, questionNo) {
    return `${sessionId}:${subjectId}:${questionNo}`;
}
function compareText(a, b) {
    return a.localeCompare(b, "th");
}
function buildBookletBlocks(raw, questionCount, unlock) {
    var _a, _b, _c, _d;
    const byBooklet = new Map();
    // 1) group ตาม booklet_id
    for (const r of raw) {
        let block = byBooklet.get(r.booklet_id);
        if (!block) {
            block = {
                bookletId: r.booklet_id,
                examCode: unlock === 1
                    ? r.exam_code
                    : String(r.random_num), // ถ้าไม่ unlock ให้โชว์แค่เลขสุ่ม
                questionCount: 0,
                questions: [],
            };
            byBooklet.set(r.booklet_id, block);
        }
        block.questions.push({
            questionNo: r.question_no,
            label: (_a = r.label) !== null && _a !== void 0 ? _a : `ข้อ ${r.question_no}`,
            category: (_b = r.category) !== null && _b !== void 0 ? _b : null,
            grader1Score: r.grader1_score != null ? Number(r.grader1_score) : null,
            grader1Name: (_c = r.grader1_names) !== null && _c !== void 0 ? _c : null,
            grader2Score: r.grader2_score != null ? Number(r.grader2_score) : null,
            grader2Name: (_d = r.grader2_names) !== null && _d !== void 0 ? _d : null,
            finalScore: r.final_score != null ? Number(r.final_score) : null,
        });
    }
    // 2) padding ให้ครบ 1..questionCount ทุกเล่ม
    for (const block of byBooklet.values()) {
        const map = new Map();
        for (const q of block.questions) {
            map.set(q.questionNo, q);
        }
        const maxQ = questionCount && questionCount > 0
            ? questionCount
            : Array.from(map.keys()).reduce((m, q) => Math.max(m, q), 0);
        const filled = [];
        for (let q = 1; q <= maxQ; q++) {
            const s = map.get(q);
            filled.push(s !== null && s !== void 0 ? s : {
                questionNo: q,
                label: `ข้อ ${q}`,
                category: null,
                grader1Score: null,
                grader1Name: null,
                grader2Score: null,
                grader2Name: null,
                finalScore: null,
            });
        }
        block.questionCount = maxQ;
        block.questions = filled;
    }
    // 3) sort ตาม bookletId เพื่อให้เรียงสวย ๆ
    return Array.from(byBooklet.values()).sort((a, b) => a.bookletId - b.bookletId);
}
function buildQuestionRows(stats, questionCount) {
    var _a, _b, _c, _d, _e, _f, _g;
    const byQ = new Map();
    for (const s of stats) {
        byQ.set(s.question_no, s);
    }
    // ถ้า questionCount = 0 ให้ใช้ max จาก stats
    const maxQ = questionCount && questionCount > 0
        ? questionCount
        : stats.reduce((mx, s) => Math.max(mx, s.question_no), 0);
    const rows = [];
    for (let q = 1; q <= maxQ; q++) {
        const s = byQ.get(q);
        rows.push({
            questionNo: q,
            label: (_a = s === null || s === void 0 ? void 0 : s.label) !== null && _a !== void 0 ? _a : `ข้อ ${q}`,
            category: (_b = s === null || s === void 0 ? void 0 : s.category) !== null && _b !== void 0 ? _b : null,
            grader1Score: (_c = s === null || s === void 0 ? void 0 : s.grader1_score) !== null && _c !== void 0 ? _c : null,
            grader1Name: (_d = s === null || s === void 0 ? void 0 : s.grader1_names) !== null && _d !== void 0 ? _d : null,
            grader2Score: (_e = s === null || s === void 0 ? void 0 : s.grader2_score) !== null && _e !== void 0 ? _e : null,
            grader2Name: (_f = s === null || s === void 0 ? void 0 : s.grader2_names) !== null && _f !== void 0 ? _f : null,
            finalScore: (_g = s === null || s === void 0 ? void 0 : s.final_score) !== null && _g !== void 0 ? _g : null,
        });
    }
    return rows;
}
class GradingReportService {
    /**
     * ดึงคะแนนรายถุง รายวิชา แบบ dynamic ตามจำนวนข้อ
     * - 1 ข้อตรวจ 2 คน → เฉลี่ยด้วย AVG แล้ว
     */
    static drawBagScorePage(doc, info, booklets, questionCount, questionLabels, unlock) {
        var _a, _b, _c, _d, _e;
        const fontNormal = path_1.default.resolve("fonts/THSarabunNew.ttf");
        const fontBold = path_1.default.resolve("fonts/THSarabunNew-Bold.ttf");
        const pageWidth = doc.page.width;
        const pageHeight = doc.page.height;
        const { left, right, top, bottom } = doc.page.margins;
        const contentWidth = pageWidth - left - right;
        const labelMap = new Map(questionLabels.map((q) => [q.question_no, q.label]));
        const title_code = unlock === 1 ? "รหัสประจำตัวสอบ" : "เลขรหัส";
        // =========================================================
        // ========================= HEADER ========================
        // =========================================================
        let y = top;
        const headerY = y;
        // ✅ title กลาง
        doc.font(fontBold).fontSize(16).text(`เอกสารคะแนนการทดสอบเพื่อบรรจุเป็นข้าราชการอัยการในตำแหน่งอัยการผู้ช่วย พ.ศ.${info === null || info === void 0 ? void 0 : info.year_be} (${info === null || info === void 0 ? void 0 : info.campaign_size})`, left, headerY, { width: contentWidth, align: "center" });
        // ✅ ถุงที่ ขวา (ระนาบเดียวกัน)
        doc.font(fontNormal).fontSize(30).text(`ถุงที่ ${info === null || info === void 0 ? void 0 : info.bag_no}`, left, headerY, { width: contentWidth, align: "right" });
        y = headerY + 24;
        doc.font(fontNormal).fontSize(14).text(`วิชา${info === null || info === void 0 ? void 0 : info.subject_name}`, left, y, { width: contentWidth, align: "center" });
        y = doc.y + 10; // ✅ start table หลัง header
        // =========================================================
        // ===================== TABLE CONFIG ======================
        // =========================================================
        const totalRows = 30;
        // คอลัมน์: รหัส + (4*question) + รวม + รวมทั้งหมด
        const colCodeWidth = 60;
        const colPerScoreWidth = 22; // ค.1 / ค.2 / ต่าง / เฉลี่ย
        const colsPerQuestion = 4;
        const colSumWidth = 40;
        const baseRowH1 = 42;
        const baseRowH2 = 18;
        const baseRowH = 16;
        const totalQuestionCols = questionCount * colsPerQuestion;
        const usedWidth = colCodeWidth + totalQuestionCols * colPerScoreWidth + colSumWidth * 2;
        // ✅ scale กว้าง
        const widthScale = usedWidth > contentWidth ? contentWidth / usedWidth : 1;
        // ✅ scale สูง (สำคัญมาก: นับเฉพาะพื้นที่จริงหลัง header)
        const availableTableHeight = pageHeight - bottom - y;
        const headerH = baseRowH1 + baseRowH2;
        const bodyH = totalRows * baseRowH;
        const needH = headerH + bodyH;
        const heightScale = needH > availableTableHeight ? availableTableHeight / needH : 1;
        const scale = Math.min(widthScale, heightScale, 1);
        // scaled widths
        const cwCode = colCodeWidth * scale;
        const cwScore = colPerScoreWidth * scale;
        const cwSum = colSumWidth * scale;
        // scaled heights
        const rowH1 = baseRowH1 * scale;
        const rowH2 = baseRowH2 * scale;
        const rowH = baseRowH * scale;
        const fontHeaderSize = Math.max(7, 10 * scale);
        const fontBodySize = Math.max(6, 9 * scale);
        const startX = left;
        // =========================================================
        // ===================== DRAW TABLE HEADER =================
        // =========================================================
        const drawHeader = (title_code) => {
            var _a;
            let x = startX;
            doc.lineWidth(0.5).strokeColor("black");
            doc.font(fontBold).fontSize(fontHeaderSize);
            // ช่องรหัส (กิน 2 แถว)
            doc.rect(x, y, cwCode, rowH1 + rowH2).stroke();
            doc.text(title_code, x, y + 6 * scale, { width: cwCode, align: "center" });
            x += cwCode;
            // แถวบน: ข้อ + label
            for (let q = 1; q <= questionCount; q++) {
                const groupW = colsPerQuestion * cwScore;
                const label = (_a = labelMap.get(q)) !== null && _a !== void 0 ? _a : "";
                doc.rect(x, y, groupW, rowH1).stroke();
                doc.text(`ข้อ ${q}\n${label}`, x, y + 4 * scale, {
                    width: groupW,
                    align: "center",
                    ellipsis: true,
                });
                x += groupW;
            }
            // รวมรายวิชา + รวมทั้งหมด (กิน 2 แถว)
            doc.rect(x, y, cwSum, rowH1 + rowH2).stroke();
            doc.text("รวม", x, y + 6 * scale, { width: cwSum, align: "center" });
            x += cwSum;
            doc.rect(x, y, cwSum, rowH1 + rowH2).stroke();
            doc.text("รวมทั้งหมด", x, y + 6 * scale, { width: cwSum, align: "center" });
            // แถวล่าง: หัวคอลัมน์ย่อย
            y += rowH1;
            x = startX + cwCode;
            const subHeads = ["ค.1", "ค.2", "ต่าง", "เฉลี่ย"];
            for (let q = 1; q <= questionCount; q++) {
                for (let h = 0; h < colsPerQuestion; h++) {
                    doc.rect(x, y, cwScore, rowH2).stroke();
                    doc.text(subHeads[h], x, y + 3 * scale, {
                        width: cwScore,
                        align: "center",
                    });
                    x += cwScore;
                }
            }
            y += rowH2;
            // ตั้งฟอนต์ body ต่อ
            doc.font(fontNormal).fontSize(fontBodySize);
        };
        drawHeader(title_code);
        // =========================================================
        // ======================= TABLE BODY ======================
        // =========================================================
        for (let i = 0; i < totalRows; i++) {
            const bk = booklets[i]; // ✅ เอาแค่ 30 เล่มแรก (ถ้าน้อยกว่าก็เป็น undefined)
            let x = startX;
            // ช่องรหัส
            doc.rect(x, y, cwCode, rowH).stroke();
            if (bk) {
                const textY = y + Math.max(1, (rowH - fontBodySize) / 2);
                doc.text((_a = bk.examCode) !== null && _a !== void 0 ? _a : "", x + 2 * scale, textY, {
                    width: cwCode - 4 * scale,
                    align: "left",
                    ellipsis: true,
                });
            }
            x += cwCode;
            // รายข้อ
            let totalPerSubject = 0;
            for (let q = 1; q <= questionCount; q++) {
                // ✅ ถ้า bk ไม่มี ก็วาดช่องว่าง
                const qRow = (_b = bk === null || bk === void 0 ? void 0 : bk.questions) === null || _b === void 0 ? void 0 : _b.find((qq) => qq.questionNo === q);
                const s1 = (_c = qRow === null || qRow === void 0 ? void 0 : qRow.grader1Score) !== null && _c !== void 0 ? _c : null;
                const s2 = (_d = qRow === null || qRow === void 0 ? void 0 : qRow.grader2Score) !== null && _d !== void 0 ? _d : null;
                const diff = s1 != null && s2 != null ? Math.abs(Number(s1) - Number(s2)) : null;
                const avg = s1 != null && s2 != null
                    ? (Number(s1) + Number(s2)) / 2
                    : (_e = qRow === null || qRow === void 0 ? void 0 : qRow.finalScore) !== null && _e !== void 0 ? _e : null;
                const vals = [s1, s2, diff, avg];
                vals.forEach((val) => {
                    doc.rect(x, y, cwScore, rowH).stroke();
                    doc.text(val == null ? "" : Number(val).toFixed(1), x + 1 * scale, y + 3 * scale, {
                        width: cwScore - 2 * scale,
                        align: "center",
                        ellipsis: true,
                    });
                    x += cwScore;
                });
                if (avg != null)
                    totalPerSubject += Number(avg);
            }
            // รวมรายวิชา
            doc.rect(x, y, cwSum, rowH).stroke();
            doc.text(bk ? totalPerSubject.toFixed(1) : "", x, y + 3 * scale, {
                width: cwSum,
                align: "right",
            });
            x += cwSum;
            // รวมทั้งหมด (ใช้ค่าเดียวกันไปก่อน)
            doc.rect(x, y, cwSum, rowH).stroke();
            doc.text(bk ? totalPerSubject.toFixed(1) : "", x, y + 3 * scale, {
                width: cwSum,
                align: "right",
            });
            y += rowH;
        }
    }
    static getScoresForBagSubject(bagId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const conn = yield DB_1.DB.getInstance().getConnection();
            const subjectId = 0;
            try {
                // 1) หา question_count ก่อน
                const questionCount = (_a = (yield (0, grading_report_repo_1.findQuestionCountForBagSubject)(conn, bagId, subjectId))) !== null && _a !== void 0 ? _a : 0;
                // 2) ดึงข้อมูล row ดิบ (booklet_id, exam_code, question_no, avg_score)
                const rawRows = yield (0, grading_report_repo_1.findQuestionAveragesForBagSubject)(conn, bagId, subjectId);
                // 3) รวมเป็น per-booklet แบบ dynamic
                const byBooklet = new Map();
                for (const row of rawRows) {
                    const bookletId = row.booklet_id;
                    const questionNo = Number(row.question_no);
                    const avgScore = Number((_b = row.avg_score) !== null && _b !== void 0 ? _b : 0);
                    if (!byBooklet.has(bookletId)) {
                        // เตรียม object เปล่าพร้อม perQuestion ทุกข้อเป็น null ก่อนก็ได้
                        const perQuestion = {};
                        for (let q = 1; q <= questionCount; q++) {
                            perQuestion[q] = null;
                        }
                        byBooklet.set(bookletId, {
                            bookletId,
                            examCode: row.exam_code,
                            perQuestion,
                            totalScore: 0,
                        });
                    }
                    const agg = byBooklet.get(bookletId);
                    // ใส่คะแนนเฉลี่ยในข้อที่ตรงกัน
                    agg.perQuestion[questionNo] = avgScore;
                }
                // 4) คำนวณ totalScore ให้แต่ละเล่ม
                const rows = Array.from(byBooklet.values()).map((r) => {
                    let sum = 0;
                    for (let q = 1; q <= questionCount; q++) {
                        const sc = r.perQuestion[q];
                        if (sc != null) {
                            sum += Number(sc);
                        }
                    }
                    return Object.assign(Object.assign({}, r), { totalScore: sum });
                });
                return {
                    bagId,
                    subjectId,
                    questionCount,
                    rows,
                };
            }
            finally {
                conn.release();
            }
        });
    }
    static getBagScoresReport(bagId_1) {
        return __awaiter(this, arguments, void 0, function* (bagId, subjectId = 0) {
            var _a;
            const conn = yield DB_1.DB.getInstance().getConnection();
            try {
                // 1) จำนวนข้อจาก session_subjects (เหมือนเดิม)
                const questionCount = (_a = (yield (0, grading_report_repo_1.findQuestionCountForBagSubject)(conn, bagId, subjectId))) !== null && _a !== void 0 ? _a : 0;
                const questionLabels = yield (0, grading_report_repo_1.findQuestionLabelForBagSubject)(conn, bagId, subjectId);
                console.log("questionLabels", questionLabels);
                // 2) raw รายเล่ม-รายข้อ
                const rawPerBooklet = yield (0, grading_report_repo_1.findBookletQuestionStatsForBag)(conn, bagId, subjectId);
                const result_is_unlock = yield (0, grading_report_repo_1.getUnlockCampaignByBagId)(conn, bagId);
                //  console.log(result_is_unlock)
                console.log(result_is_unlock[0].campaign_id);
                const unlock = result_is_unlock[0].is_unlock;
                const booklets = buildBookletBlocks(rawPerBooklet, questionCount, unlock);
                return {
                    bagId,
                    subjectId,
                    questionCount,
                    booklets,
                    questionLabels: questionLabels !== null && questionLabels !== void 0 ? questionLabels : [],
                };
            }
            finally {
                conn.release();
            }
        });
    }
    static generateBagScorePdf(bagId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e;
            const info = yield (0, grading_report_repo_1.getInfomation)(bagId);
            const reportDB = yield GradingReportService.getBagScoresReport(bagId, 0);
            const result_is_unlock = yield (0, grading_report_repo_1.getUnlockCampaignNoconn)(bagId);
            const unlock = result_is_unlock[0].is_unlock;
            const report = Object.assign(Object.assign({}, reportDB), { booklets: [...reportDB.booklets].sort((a, b) => a.examCode.localeCompare(b.examCode, undefined, { numeric: true })) });
            const { booklets, questionCount, questionLabels } = report;
            const labelMap = new Map(questionLabels.map((q) => [q.question_no, q.label]));
            const doc = new pdfkit_1.default({
                size: "A4",
                layout: "landscape",
                margins: { top: 40, bottom: 40, left: 40, right: 40 },
            });
            const fontNormal = path_1.default.resolve("fonts/THSarabunNew.ttf");
            const fontBold = path_1.default.resolve("fonts/THSarabunNew-Bold.ttf");
            const chunks = [];
            doc.on("data", (c) => chunks.push(c));
            const pdfPromise = new Promise((resolve, reject) => {
                doc.on("end", () => resolve(Buffer.concat(chunks)));
                doc.on("error", reject);
            });
            // =========================================================
            // ========================= HEADER ========================
            // =========================================================
            const pageWidth = doc.page.width;
            const pageHeight = doc.page.height;
            const { left, right, top, bottom } = doc.page.margins;
            const contentWidth = pageWidth - left - right;
            let y = top;
            const headerY = y;
            // ✅ Title กลาง (บรรทัดเดียวกับถุง)
            doc.font(fontBold).fontSize(16).text(`เอกสารคะแนนการทดสอบเพื่อบรรจุเป็นข้าราชการอัยการในตำแหน่งอัยการผู้ช่วย พ.ศ.${info === null || info === void 0 ? void 0 : info.year_be} (${info === null || info === void 0 ? void 0 : info.campaign_size})`, left, headerY, { width: contentWidth, align: "center" });
            // ✅ ถุงที่ ขวา ระนาบเดียวกัน
            doc.font(fontNormal).fontSize(30).text(`ถุงที่ ${info === null || info === void 0 ? void 0 : info.bag_no}`, left, headerY, { width: contentWidth, align: "right" });
            y = headerY + 24;
            doc.font(fontNormal).fontSize(14).text(`วิชา${info === null || info === void 0 ? void 0 : info.subject_name}`, left, y, { width: contentWidth, align: "center" });
            y = doc.y + 10;
            // =========================================================
            // ===================== TABLE CONFIG ======================
            // =========================================================
            const totalRows = 30;
            const colCodeWidth = 60;
            const colPerScoreWidth = 22; // ค.1 / ค.2 / ต่าง / เฉลี่ย
            const colsPerQuestion = 4;
            const colSumWidth = 40;
            const totalQuestionCols = questionCount * colsPerQuestion;
            const usedWidth = colCodeWidth +
                totalQuestionCols * colPerScoreWidth +
                colSumWidth * 2;
            // ✅ scale ด้านกว้าง
            const tableWidth = contentWidth;
            const widthScale = usedWidth > tableWidth ? tableWidth / usedWidth : 1;
            // ✅ scale ด้านสูง (สำคัญ: ใช้พื้นที่จริงหลัง header)
            const baseRowH1 = 42;
            const baseRowH2 = 18;
            const baseRowH = 16;
            const availableTableHeight = pageHeight - bottom - y;
            const headerH = baseRowH1 + baseRowH2;
            const bodyH = totalRows * baseRowH;
            const needH = headerH + bodyH;
            const heightScale = needH > availableTableHeight ? availableTableHeight / needH : 1;
            const scale = Math.min(widthScale, heightScale, 1);
            // scaled widths/heights
            const cwCode = colCodeWidth * scale;
            const cwScore = colPerScoreWidth * scale;
            const cwSum = colSumWidth * scale;
            const rowH1 = baseRowH1 * scale;
            const rowH2 = baseRowH2 * scale;
            const rowH = baseRowH * scale;
            const fontHeaderSize = Math.max(7, 10 * scale);
            const fontBodySize = Math.max(6, 9 * scale);
            const startX = left;
            // =========================================================
            // ===================== DRAW TABLE HEADER =================
            // =========================================================
            const drawHeader = (is_unlock) => {
                var _a;
                let x = startX;
                const title_code = is_unlock === 1 ? "รหัสประจำตัวสอบ" : "เลขรหัส";
                doc.lineWidth(0.5).strokeColor("black");
                doc.font(fontBold).fontSize(fontHeaderSize);
                // แถวบน: ช่องรหัส (กิน 2 แถว)
                doc.rect(x, y, cwCode, rowH1 + rowH2).stroke();
                doc.text(title_code, x, y + 6 * scale, { width: cwCode, align: "center" });
                x += cwCode;
                for (let q = 1; q <= questionCount; q++) {
                    const groupW = colsPerQuestion * cwScore;
                    const label = (_a = labelMap.get(q)) !== null && _a !== void 0 ? _a : "";
                    doc.rect(x, y, groupW, rowH1).stroke();
                    doc.text(`ข้อ ${q}\n${label}`, x, y + 4 * scale, {
                        width: groupW,
                        align: "center",
                        ellipsis: true,
                    });
                    x += groupW;
                }
                // รวมรายวิชา + รวมทั้งหมด (กิน 2 แถว)
                doc.rect(x, y, cwSum, rowH1 + rowH2).stroke();
                doc.text("รวม", x, y + 6 * scale, { width: cwSum, align: "center" });
                x += cwSum;
                doc.rect(x, y, cwSum, rowH1 + rowH2).stroke();
                doc.text("รวมทั้งหมด", x, y + 6 * scale, { width: cwSum, align: "center" });
                // แถวล่าง: หัวคอลัมน์ย่อย
                y += rowH1;
                x = startX + cwCode;
                const subHeads = ["ค.1", "ค.2", "ต่าง", "เฉลี่ย"];
                for (let q = 1; q <= questionCount; q++) {
                    for (let h = 0; h < colsPerQuestion; h++) {
                        doc.rect(x, y, cwScore, rowH2).stroke();
                        doc.text(subHeads[h], x, y + 3 * scale, {
                            width: cwScore,
                            align: "center",
                        });
                        x += cwScore;
                    }
                }
                // ปิดท้าย header
                y += rowH2;
                doc.font(fontNormal).fontSize(fontBodySize);
            };
            drawHeader(unlock);
            // =========================================================
            // ======================= TABLE BODY ======================
            // =========================================================
            // ✅ ลูป 30 แถวเสมอ (ถ้าไม่มี bk -> วาดแถวเปล่า)
            for (let i = 0; i < totalRows; i++) {
                const bk = booklets[i];
                let x = startX;
                // รหัสสอบ
                doc.rect(x, y, cwCode, rowH).stroke();
                if (bk) {
                    const textY = y + Math.max(1, (rowH - fontBodySize) / 2);
                    doc.text((_a = bk.examCode) !== null && _a !== void 0 ? _a : "", x + 2 * scale, textY, {
                        width: cwCode - 4 * scale,
                        align: "left",
                        ellipsis: true,
                    });
                }
                x += cwCode;
                let totalPerSubject = 0;
                for (let q = 1; q <= questionCount; q++) {
                    const qRow = (_b = bk === null || bk === void 0 ? void 0 : bk.questions) === null || _b === void 0 ? void 0 : _b.find((qq) => qq.questionNo === q);
                    const s1 = (_c = qRow === null || qRow === void 0 ? void 0 : qRow.grader1Score) !== null && _c !== void 0 ? _c : null;
                    const s2 = (_d = qRow === null || qRow === void 0 ? void 0 : qRow.grader2Score) !== null && _d !== void 0 ? _d : null;
                    const diff = s1 != null && s2 != null ? Math.abs(Number(s1) - Number(s2)) : null;
                    const avg = s1 != null && s2 != null
                        ? (Number(s1) + Number(s2)) / 2
                        : (_e = qRow === null || qRow === void 0 ? void 0 : qRow.finalScore) !== null && _e !== void 0 ? _e : null;
                    const vals = [s1, s2, diff, avg];
                    vals.forEach((val) => {
                        doc.rect(x, y, cwScore, rowH).stroke();
                        doc.text(val == null ? "" : Number(val).toFixed(1), x, y + 3 * scale, {
                            width: cwScore,
                            align: "center",
                            ellipsis: true,
                        });
                        x += cwScore;
                    });
                    if (avg != null)
                        totalPerSubject += Number(avg);
                }
                // รวมรายวิชา
                doc.rect(x, y, cwSum, rowH).stroke();
                doc.text(bk ? totalPerSubject.toFixed(1) : "", x, y + 3 * scale, {
                    width: cwSum,
                    align: "center",
                });
                x += cwSum;
                // รวมทั้งหมด (ตอนนี้ใช้ค่าเดียวกัน)
                doc.rect(x, y, cwSum, rowH).stroke();
                doc.text(bk ? totalPerSubject.toFixed(1) : "", x, y + 3 * scale, {
                    width: cwSum,
                    align: "center",
                });
                y += rowH;
            }
            doc.end();
            return pdfPromise;
        });
    }
    static generateCampaignBagScoresPdf(campaignId) {
        return __awaiter(this, void 0, void 0, function* () {
            const conn = yield DB_1.DB.getInstance().getConnection();
            try {
                // ดึงถุงทั้งหมดใน campaign นี้
                const bagRows = yield (0, grading_report_repo_1.getAllBags)(conn, campaignId);
                const unlock = yield (0, grading_report_repo_1.getCampaignUnlock)(conn, campaignId);
                console.log(campaignId, bagRows);
                if (!bagRows.length) {
                    throw new Error("ไม่พบถุงใด ๆ ในแคมเปญนี้");
                }
                const doc = new pdfkit_1.default({
                    size: "A4",
                    layout: "landscape",
                    margins: { top: 40, bottom: 40, left: 40, right: 40 },
                });
                const chunks = [];
                doc.on("data", (c) => chunks.push(c));
                const pdfPromise = new Promise((resolve, reject) => {
                    doc.on("end", () => resolve(Buffer.concat(chunks)));
                    doc.on("error", reject);
                });
                let firstPage = true;
                for (const bag of bagRows) {
                    const bagId = bag.bag_id; // 👈 ใช้ bag.bag_id ไม่ใช่ bag.id
                    if (!firstPage) {
                        doc.addPage({
                            size: "A4",
                            layout: "landscape",
                            margins: { top: 40, bottom: 40, left: 40, right: 40 },
                        });
                    }
                    else {
                        firstPage = false;
                    }
                    const info = yield (0, grading_report_repo_1.getInfomation)(bagId);
                    const report = yield GradingReportService.getBagScoresReport(bagId, 0);
                    const { booklets, questionCount, questionLabels } = report;
                    GradingReportService.drawBagScorePage(doc, info, booklets, questionCount, questionLabels, unlock);
                }
                doc.end();
                return pdfPromise;
            }
            finally {
                conn.release();
            }
        });
    }
    static generateGraderBagSummaryPdf(bagId, graderId, graderName // ส่งมาจาก controller ก็ได้
    ) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const conn = yield DB_1.DB.getInstance().getConnection();
            try {
                const info = yield (0, grading_report_repo_1.getInfomation)(bagId); // มี bag_no, subject_name, year_be, site, ฯลฯ
                const graderInfo = yield (0, grading_report_repo_1.getGraderInfo)(conn, bagId, graderId);
                console.log(graderInfo);
                const rows = yield (0, grading_report_repo_2.getGraderBagSummary)(conn, bagId, graderId);
                const doc = new pdfkit_1.default({
                    size: "A4",
                    layout: "portrait", // ใบตัวอย่างเป็นแนวตั้ง
                    margins: { top: 60, bottom: 50, left: 50, right: 50 },
                });
                const fontNormal = path_1.default.resolve("fonts/THSarabunNew.ttf");
                const fontBold = path_1.default.resolve("fonts/THSarabunNew-Bold.ttf");
                const chunks = [];
                doc.on("data", (c) => chunks.push(c));
                const pdfPromise = new Promise((resolve, reject) => {
                    doc.on("end", () => resolve(Buffer.concat(chunks)));
                    doc.on("error", reject);
                });
                const pageWidth = doc.page.width;
                const { left, right, bottom } = doc.page.margins;
                /* ===== มุมขวาบน: ถุงที่ XX ===== */
                doc
                    .font(fontNormal)
                    .fontSize(30)
                    .text(`ถุงที่ ${(_a = info === null || info === void 0 ? void 0 : info.bag_no) !== null && _a !== void 0 ? _a : ""}`, left, 30, {
                    width: pageWidth - left - right,
                    align: "right",
                });
                /* ===== Header กลาง ===== */
                doc
                    .font(fontBold)
                    .fontSize(16)
                    .text("ใบบันทึกคะแนนผู้ตรวจ", { align: "center" });
                doc.moveDown(0.3);
                doc
                    .font(fontNormal)
                    .fontSize(14)
                    .text(`วิชา ${(_b = info === null || info === void 0 ? void 0 : info.subject_name) !== null && _b !== void 0 ? _b : ""}   ปี พ.ศ. ${(_c = info === null || info === void 0 ? void 0 : info.year_be) !== null && _c !== void 0 ? _c : ""}`, { align: "center" });
                doc.moveDown(0.3);
                doc
                    .font(fontNormal)
                    .fontSize(14)
                    .text(`ข้อ ${graderInfo === null || graderInfo === void 0 ? void 0 : graderInfo.question_no}  ผู้ตรวจคนที่ ${graderInfo === null || graderInfo === void 0 ? void 0 : graderInfo.grader_order}`, { align: "center" });
                doc.moveDown(0.3);
                doc
                    .font(fontNormal)
                    .fontSize(14)
                    .text(`ชื่อ ${graderInfo === null || graderInfo === void 0 ? void 0 : graderInfo.full_name} `, { align: "center" });
                doc.moveDown(1);
                /* ===== บรรทัดข้อมูลผู้ตรวจ / สถานที่ ===== */
                // const lineY = doc.y;
                // doc
                //   .font(fontNormal)
                //   .fontSize(13)
                //   .text(`ชื่อผู้ตรวจ: ${graderName || "................................"}`, left, lineY);
                // doc.moveDown(0.4);
                // doc.text(
                //   `สนามสอบ: ${info?.site ?? "................................"}`,
                //   left
                // );
                // doc.moveDown(1);
                /* ===== ตารางรายการที่ตรวจ ===== */
                const startX = left;
                let y = doc.y + 5;
                const tableWidth = pageWidth - left - right;
                const colNoWidth = 40; // คอลัมน์ลำดับ fix ไว้
                const colScoreWidth = 100; // กว้างของคอลัมน์คะแนน (ปรับได้)
                const colQrWidth = tableWidth - colNoWidth - colScoreWidth;
                const rowHeight = 20;
                // วาดหัวตาราง
                doc.font(fontBold).fontSize(12);
                doc.rect(startX, y, colNoWidth, rowHeight).stroke();
                doc.text("ลำดับ", startX, y + 4, {
                    width: colNoWidth,
                    align: "center",
                });
                doc.rect(startX + colNoWidth, y, colQrWidth, rowHeight).stroke();
                doc.text("QR Payload", startX + colNoWidth, y + 4, {
                    width: colQrWidth,
                    align: "center",
                });
                doc
                    .rect(startX + colNoWidth + colQrWidth, y, colScoreWidth, rowHeight)
                    .stroke();
                doc.text("คะแนน", startX + colNoWidth + colQrWidth, y + 4, {
                    width: colScoreWidth,
                    align: "center",
                });
                // doc
                //   .rect(
                //     startX + colNoWidth + colQrWidth + colScoreWidth,
                //     y,
                //     colNoteWidth,
                //     rowHeight
                //   )
                //   .stroke();
                // doc.text("หมายเหตุ", startX + colNoWidth + colQrWidth + colScoreWidth, y + 4, {
                //   width: colNoteWidth,
                //   align: "center",
                // });
                y += rowHeight;
                // ฟังก์ชันเช็คขึ้นหน้าใหม่
                const ensurePage = () => {
                    var _a;
                    if (y + rowHeight > doc.page.height - bottom) {
                        doc.addPage({ layout: "portrait" });
                        // ถุงที่ และ header เล็ก ๆ บนหน้าใหม่ (ถ้าต้องการ)
                        doc
                            .font(fontNormal)
                            .fontSize(30)
                            .text(`ถุงที่ ${(_a = info === null || info === void 0 ? void 0 : info.bag_no) !== null && _a !== void 0 ? _a : ""} (ต่อ)`, left, 30, { width: pageWidth - left - right, align: "right" });
                        y = doc.page.margins.top;
                        // หัวตารางซ้ำบนหน้าใหม่
                        doc.font(fontBold).fontSize(12);
                        doc.rect(startX, y, colNoWidth, rowHeight).stroke();
                        doc.text("ลำดับ", startX, y + 4, {
                            width: colNoWidth,
                            align: "center",
                        });
                        doc.rect(startX + colNoWidth, y, colQrWidth, rowHeight).stroke();
                        doc.text("QR Payload", startX + colNoWidth, y + 4, {
                            width: colQrWidth,
                            align: "center",
                        });
                        doc
                            .rect(startX + colNoWidth + colQrWidth, y, colScoreWidth, rowHeight)
                            .stroke();
                        doc.text("คะแนน", startX + colNoWidth + colQrWidth, y + 4, {
                            width: colScoreWidth,
                            align: "center",
                        });
                        // doc
                        //   .rect(
                        //     startX + colNoWidth + colQrWidth + colScoreWidth,
                        //     y,
                        //     colNoteWidth,
                        //     rowHeight
                        //   )
                        //   .stroke();
                        // doc.text(
                        //   "หมายเหตุ",
                        //   startX + colNoWidth + colQrWidth + colScoreWidth,
                        //   y + 4,
                        //   {
                        //     width: colNoteWidth,
                        //     align: "center",
                        //   }
                        // );
                        y += rowHeight;
                    }
                };
                // เนื้อหาตาราง
                doc.font(fontNormal).fontSize(11);
                rows.forEach((row, idx) => {
                    var _a;
                    ensurePage();
                    const qrText = (_a = row.qr_payload) !== null && _a !== void 0 ? _a : "-";
                    const scoreText = row.total_score != null ? Number(row.total_score).toFixed(0) : "";
                    const xNo = startX;
                    const xQr = startX + colNoWidth;
                    const xScore = xQr + colQrWidth;
                    const xNote = xScore + colScoreWidth;
                    // กรอบ
                    doc.rect(xNo, y, colNoWidth, rowHeight).stroke();
                    doc.rect(xQr, y, colQrWidth, rowHeight).stroke();
                    doc.rect(xScore, y, colScoreWidth, rowHeight).stroke();
                    // doc.rect(xNote, y, colNoteWidth, rowHeight).stroke();
                    // ข้อมูล
                    doc.text(String(idx + 1), xNo, y + 4, {
                        width: colNoWidth,
                        align: "center",
                    });
                    doc.text(qrText, xQr + 2, y + 4, {
                        width: colQrWidth - 4,
                        align: "left",
                    });
                    doc.text(scoreText, xScore, y + 4, {
                        width: colScoreWidth, // ให้กินทั้งช่อง
                        align: "center", // จัดกลางแนวนอน
                    });
                    // หมายเหตุปล่อยว่างให้เขียนเอง
                    y += rowHeight;
                });
                doc.end();
                return pdfPromise;
            }
            finally {
                conn.release();
            }
        });
    }
    static generatePassListPdf(opts) {
        return __awaiter(this, void 0, void 0, function* () {
            const sort = opts.sort || "score";
            const order = opts.order || "desc";
            // 1) data
            const { examInfo, rows } = yield passlist_repo_1.default.getPassListRows({
                campaignId: opts.campaignId,
                sort,
                order,
            });
            // 2) pdf doc
            const doc = new pdfkit_1.default({
                size: "A4",
                margins: { top: 40, bottom: 40, left: 48, right: 48 },
                autoFirstPage: true,
            });
            const fontNormal = path_1.default.resolve("fonts/THSarabunNew.ttf");
            const fontBold = path_1.default.resolve("fonts/THSarabunNew-Bold.ttf");
            const buffers = [];
            doc.on("data", (b) => buffers.push(b));
            const pdfPromise = new Promise((resolve, reject) => {
                doc.on("end", () => resolve(Buffer.concat(buffers)));
                doc.on("error", reject);
            });
            // ===== Header (ปรับข้อความให้ตรงของคุณได้) =====
            doc.font(fontNormal).fontSize(14).text("บัญชีรายชื่อผู้สอบผ่านข้อเขียน", {
                align: "center",
            });
            doc.moveDown(0.2);
            doc
                .font(fontNormal)
                .fontSize(12)
                .text("(แนบท้ายประกาศ...)", { align: "center" });
            doc.moveDown(0.2);
            doc
                .font(fontNormal)
                .fontSize(12)
                .text(`อัยการผู้ช่วย พ.ศ.${examInfo.year_be} (${examInfo.campaign_size})`, { align: "center" });
            doc.moveDown(0.2);
            doc.font(fontNormal).fontSize(12).text(`ณ ${examInfo.site}`, { align: "center" });
            doc.moveDown(0.6);
            // ===== Table layout =====
            const pageWidth = doc.page.width;
            const { left, right, bottom } = doc.page.margins;
            const tableWidth = pageWidth - left - right;
            // 3 คอลัมน์แบบรูป: ลำดับ | เลขประจำตัวสอบ | ชื่อ-สกุล
            // ถ้า includeScore=1 ให้เพิ่มคอลัมน์คะแนน
            const colW = opts.includeScore
                ? [tableWidth * 0.10, tableWidth * 0.22, tableWidth * 0.48, tableWidth * 0.20]
                : [tableWidth * 0.12, tableWidth * 0.24, tableWidth * 0.64];
            const startX = left;
            let y = doc.y;
            const headerH = 20;
            const rowH = 18;
            const x1 = startX;
            const x2 = x1 + colW[0];
            const x3 = x2 + colW[1];
            const x4 = x3 + colW[2]; // ถ้า includeScore=1 จะเป็น col4 start
            const tableRight = startX + tableWidth;
            const drawHeader = () => {
                doc.lineWidth(0.7).strokeColor("black");
                doc.rect(startX, y, tableWidth, headerH).stroke();
                doc.moveTo(x2, y).lineTo(x2, y + headerH).stroke();
                doc.moveTo(x3, y).lineTo(x3, y + headerH).stroke();
                if (opts.includeScore)
                    doc.moveTo(x4, y).lineTo(x4, y + headerH).stroke();
                const ty = y + 4;
                doc.font(fontBold).fontSize(12);
                doc.text("ลำดับที่", x1, ty, { width: colW[0], align: "center" });
                doc.text("เลขประจำตัวสอบ", x2, ty, { width: colW[1], align: "center" });
                doc.text("ชื่อ-สกุล", x3, ty, { width: colW[2], align: "center" });
                if (opts.includeScore) {
                    doc.text("คะแนน", x4, ty, { width: colW[3], align: "center" });
                }
                y += headerH;
                doc.font(fontNormal).fontSize(12);
            };
            const ensureSpace = () => {
                if (y + rowH > doc.page.height - bottom) {
                    doc.addPage();
                    y = doc.page.margins.top;
                    drawHeader();
                }
            };
            drawHeader();
            // ===== Rows =====
            rows.forEach((r, idx) => {
                var _a;
                ensureSpace();
                doc.rect(startX, y, tableWidth, rowH).stroke();
                doc.moveTo(x2, y).lineTo(x2, y + rowH).stroke();
                doc.moveTo(x3, y).lineTo(x3, y + rowH).stroke();
                if (opts.includeScore)
                    doc.moveTo(x4, y).lineTo(x4, y + rowH).stroke();
                const ty = y + 3;
                doc.text(String(idx + 1), x1, ty, { width: colW[0], align: "center" });
                doc.text(r.userCode, x2, ty, { width: colW[1], align: "center" });
                const fullName = `${(_a = r.title) !== null && _a !== void 0 ? _a : ""}${r.title ? " " : ""}${r.fullName}`;
                doc.text(fullName, x3 + 6, ty, { width: colW[2] - 12, align: "left" });
                if (opts.includeScore) {
                    doc.text(r.finalScore == null ? "-" : Number(r.finalScore).toFixed(2), x4, ty, { width: colW[3], align: "center" });
                }
                y += rowH;
            });
            doc.end();
            return pdfPromise;
        });
    }
    static generateRankingPdf(opts) {
        return __awaiter(this, void 0, void 0, function* () {
            // 1. ดึงข้อมูล Campaign และ คะแนนดิบ
            const examInfo = yield ranking_report_repo_1.default.getExamInfo(opts.campaignId);
            const rawData = yield ranking_report_repo_1.default.getRankingRawRows({
                campaignId: opts.campaignId,
                subjectIds: opts.subjectIds,
            });
            // 2. Aggregate Data by User
            const usersMap = new Map();
            for (const row of rawData) {
                if (!usersMap.has(row.user_code)) {
                    usersMap.set(row.user_code, {
                        userCode: row.user_code,
                        title: row.title,
                        fullName: row.full_name,
                        roomCode: row.room_code,
                        totalScore: 0,
                        groupScores: [],
                        isCompleted: true, // ตั้งต้น true, ถ้าเจอข้อไหนไม่ครบจะปรับเป็น false
                        scoresMap: new Map(),
                    });
                }
                const user = usersMap.get(row.user_code);
                const key = keyOf(row.session_id, row.subject_id, row.question_no);
                // เก็บลง Map รายข้อ
                user.scoresMap.set(key, row.avg_score);
                // เช็คว่าตรวจครบไหม (ถ้าข้อนี้ has_both=0 แสดงว่าไม่ครบ)
                if (!row.has_both) {
                    user.isCompleted = false;
                }
                // บวกคะแนนเข้า Total Score (นับทุกข้อที่ Query มา)
                // *สำคัญ* ตรงนี้คือคะแนนรวมจริง ไม่เกี่ยวกับกลุ่ม Tie-break
                if (row.avg_score != null) {
                    user.totalScore += Number(row.avg_score);
                }
            }
            // 3. คำนวณคะแนนตาม Group (Tie-breaker)
            const groups = opts.groups || [];
            for (const user of usersMap.values()) {
                // วนลูปตามกลุ่มที่ User ตั้งไว้ (เช่น กฎหมายอาญา, กฎหมายแพ่ง)
                const gScores = groups.map((group) => {
                    let sum = 0;
                    // รวมคะแนนเฉพาะข้อที่อยู่ในกลุ่มนี้
                    for (const item of group.items) {
                        const k = keyOf(item.sessionId, item.subjectId, item.questionNo);
                        const sc = user.scoresMap.get(k);
                        if (sc != null)
                            sum += Number(sc);
                    }
                    return sum;
                });
                user.groupScores = gScores;
            }
            // 4. แปลงเป็น Array และ Filter
            let rankingList = Array.from(usersMap.values());
            if (opts.onlyCompleted) {
                rankingList = rankingList.filter((u) => u.isCompleted);
            }
            // 5. Sorting Logic (หัวใจสำคัญ)
            const sortBy = (opts.sortBy || "TOTAL_DESC");
            rankingList.sort((a, b) => {
                // 5.1 Sort ตามชื่อ หรือ รหัส (กรณีเลือก Sort แบบพิเศษ)
                if (sortBy === "EXAMCODE_ASC")
                    return a.userCode.localeCompare(b.userCode);
                if (sortBy === "EXAMCODE_DESC")
                    return b.userCode.localeCompare(a.userCode);
                if (sortBy === "NAME_ASC")
                    return a.fullName.localeCompare(b.fullName, "th");
                if (sortBy === "NAME_DESC")
                    return b.fullName.localeCompare(a.fullName, "th");
                // 5.2 Sort ตามคะแนนรวม (TOTAL) เป็นหลัก
                const dir = sortBy === "TOTAL_ASC" ? 1 : -1; // ปกติ DESC (-1)
                if (Math.abs(a.totalScore - b.totalScore) > 0.0001) {
                    return (a.totalScore - b.totalScore) * dir;
                }
                // 5.3 Tie-break: คะแนนรวมเท่ากัน -> ดูคะแนน Group ตามลำดับ
                for (let i = 0; i < groups.length; i++) {
                    const scoreA = a.groupScores[i];
                    const scoreB = b.groupScores[i];
                    if (Math.abs(scoreA - scoreB) > 0.0001) {
                        // คะแนนกลุ่มมาก = อันดับดีกว่า (ใช้ dir เหมือน Total)
                        return (scoreA - scoreB) * dir;
                    }
                }
                // 5.4 ยังเท่ากันอีก -> เรียงตามรหัสสอบ (น้อยไปมาก)
                return a.userCode.localeCompare(b.userCode);
            });
            // 6. Limit Top N (ถ้ามี)
            if (opts.limit > 0) {
                rankingList = rankingList.slice(0, opts.limit);
            }
            // 7. Generate PDF
            return GradingReportService.createRankingPdfDocument(rankingList, examInfo, opts);
        });
    }
    // แยก function สร้าง PDF ออกมาเพื่อให้โค้ดสะอาด
    // แยก function สร้าง PDF ออกมาเพื่อให้โค้ดสะอาด
    static createRankingPdfDocument(data, info, opts) {
        const doc = new pdfkit_1.default({
            size: "A4",
            margins: { top: 40, bottom: 40, left: 40, right: 40 },
            autoFirstPage: true,
        });
        const fontNormal = path_1.default.resolve("fonts/THSarabunNew.ttf");
        const fontBold = path_1.default.resolve("fonts/THSarabunNew-Bold.ttf");
        const buffers = [];
        doc.on("data", (b) => buffers.push(b));
        const pdfPromise = new Promise((resolve, reject) => {
            doc.on("end", () => resolve(Buffer.concat(buffers)));
            doc.on("error", reject);
        });
        // --- PDF Content Drawing ---
        const drawHeaderInfo = () => {
            doc.font(fontBold).fontSize(16).text("บัญชีรายชื่อเรียงลำดับคะแนน", { align: "center" });
            doc.font(fontNormal).fontSize(12).text(`สนามสอบ: ${info.site} (${info.campaign_size} ${info.year_be})`, { align: "center" });
            doc.moveDown(0.5);
        };
        drawHeaderInfo();
        const pageWidth = doc.page.width - 80; // margins left+right
        const colWidths = [
            pageWidth * 0.1, // ลำดับ
            pageWidth * 0.2, // รหัส
            pageWidth * 0.4, // ชื่อ
            pageWidth * 0.15, // ห้อง/ที่นั่ง
            pageWidth * 0.15 // คะแนนรวม
        ];
        const headers = ["ลำดับ", "รหัสประจำตัว", "ชื่อ-สกุล", "คะแนนรวม"];
        // ฟังก์ชันวาดหัวตาราง (ใช้ซ้ำตอนขึ้นหน้าใหม่)
        const drawTableHeader = (currentY) => {
            let currentX = 40;
            doc.font(fontBold).fontSize(12);
            // วาดกรอบสี่เหลี่ยมรอบหัวตาราง
            doc.lineWidth(0.5).rect(currentX, currentY, pageWidth, 20).stroke();
            headers.forEach((h, i) => {
                // วาดข้อความ
                doc.text(h, currentX, currentY + 5, { width: colWidths[i], align: "center" });
                // ขยับ X ไปจบที่ขอบขวาของคอลัมน์นี้
                currentX += colWidths[i];
                // วาดเส้นแนวตั้ง (ยกเว้นคอลัมน์สุดท้าย เพราะมีกรอบขวาอยู่แล้ว)
                if (i < headers.length - 1) {
                    doc.moveTo(currentX, currentY)
                        .lineTo(currentX, currentY + 20)
                        .stroke();
                }
            });
        };
        // เริ่มวาดหัวตารางครั้งแรก
        let y = doc.y;
        drawTableHeader(y);
        y += 20;
        // Body
        doc.font(fontNormal).fontSize(12);
        data.forEach((row, idx) => {
            // Check Page Break
            if (y > doc.page.height - 50) {
                doc.addPage();
                drawHeaderInfo(); // วาดหัวกระดาษซ้ำ
                y = doc.y;
                drawTableHeader(y); // วาดหัวตารางซ้ำ
                y += 20;
                doc.font(fontNormal);
            }
            let x = 40;
            // วาดกรอบสี่เหลี่ยมรอบแถว (Row Border)
            doc.rect(x, y, pageWidth, 20).stroke();
            // 1. ลำดับ
            // if (opts.includeRankNo) {
            //      doc.text(String(idx + 1), x, y + 4, { width: colWidths[0], align: "center" });
            // }
            doc.text(String(idx + 1), x, y + 4, { width: colWidths[0], align: "center" });
            x += colWidths[0];
            // เส้นคั่นแนวตั้งหลังจบช่องลำดับ
            doc.moveTo(x, y).lineTo(x, y + 20).stroke();
            // 2. รหัส
            doc.text(row.userCode, x, y + 4, { width: colWidths[1], align: "center" });
            x += colWidths[1];
            // เส้นคั่นแนวตั้งหลังจบช่องรหัส
            doc.moveTo(x, y).lineTo(x, y + 20).stroke();
            // 3. ชื่อ
            const name = `${row.title ? row.title : ''}${row.fullName}`;
            doc.text(name, x + 5, y + 4, { width: colWidths[2] - 10, align: "left" });
            x += colWidths[2];
            // เส้นคั่นแนวตั้งหลังจบช่องชื่อ
            doc.moveTo(x, y).lineTo(x, y + 20).stroke();
            // // 4. ที่นั่ง
            // if (opts.includeRoomSeat) {
            //     doc.text(`${row.roomCode || '-'}/${row.seatCode || '-'}`, x, y + 4, { width: colWidths[3], align: "center" });
            // }
            // x += colWidths[3];
            // // เส้นคั่นแนวตั้งหลังจบช่องที่นั่ง
            // doc.moveTo(x, y).lineTo(x, y + 20).stroke();
            // 5. คะแนนรวม (ไม่ต้องตีเส้นปิดท้าย เพราะมีกรอบ rect วาดไว้แล้ว)
            doc.text(row.totalScore.toFixed(2), x, y + 4, { width: colWidths[4], align: "center" });
            y += 20;
        });
        doc.end();
        return pdfPromise;
    }
}
exports.GradingReportService = GradingReportService;
