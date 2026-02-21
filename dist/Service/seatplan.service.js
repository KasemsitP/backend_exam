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
exports.SeatPlanService = void 0;
// src/Service/seatplan.service.ts
const path_1 = __importDefault(require("path"));
const pdfkit_1 = __importDefault(require("pdfkit"));
const seatplan_repo_1 = __importDefault(require("../Repo/seatplan.repo"));
class SeatPlanService {
    static generateSeatPlanPdf(options) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const { session_id, campaign_id } = options;
            const title = (_a = options.title) !== null && _a !== void 0 ? _a : "ผังที่นั่งสอบ";
            const info = yield seatplan_repo_1.default.getExamInfoWithSessions(campaign_id);
            if (!info) {
                throw new Error("ไม่พบข้อมูลรอบสอบ");
            }
            const rows = yield seatplan_repo_1.default.findSeatPlanByCampaignAndSession(session_id, campaign_id);
            const doc = new pdfkit_1.default({
                size: "A4",
                margins: { top: 40, bottom: 40, left: 40, right: 40 },
                autoFirstPage: true,
            });
            const fontNormal = path_1.default.resolve("fonts/THSarabunNew.ttf");
            const fontBold = path_1.default.resolve("fonts/THSarabunNew-Bold.ttf");
            const chunks = [];
            doc.on("data", (chunk) => chunks.push(chunk));
            const pdfPromise = new Promise((resolve, reject) => {
                doc.on("end", () => resolve(Buffer.concat(chunks)));
                doc.on("error", reject);
            });
            // ===== Header =====
            doc.font(fontBold).fontSize(16).text(title, { align: "center" });
            doc.moveDown(0.3);
            doc.font(fontNormal)
                .fontSize(14)
                .text(`${info.exam.name}`, { align: "center" });
            doc.moveDown(0.3);
            doc.font(fontNormal)
                .fontSize(14)
                .text(`${info.exam.site}`, { align: "center" });
            doc.moveDown(0.3);
            // ===== Table layout =====
            const pageWidth = doc.page.width;
            const tableWidth = pageWidth - doc.page.margins.left - doc.page.margins.right;
            // แบ่ง 3 คอลัมน์เท่ากัน
            const colWidth = tableWidth / 3;
            const startX = doc.page.margins.left;
            let y = doc.y + 10;
            const rowHeight = 22;
            const x1 = startX;
            const x2 = x1 + colWidth;
            const x3 = x2 + colWidth;
            const x4 = x3 + colWidth; // ขอบขวาสุดของตาราง
            doc.lineWidth(0.7).strokeColor("black");
            // ===== Header row =====
            doc.rect(startX, y, tableWidth, rowHeight).stroke();
            // เส้นกั้น column header
            doc.moveTo(x2, y).lineTo(x2, y + rowHeight).stroke();
            doc.moveTo(x3, y).lineTo(x3, y + rowHeight).stroke();
            doc.font(fontBold).fontSize(12);
            const headerY = y + 4;
            doc.text("เลขประจำตัวที่สอบ", x1, headerY, {
                width: colWidth,
                align: "center",
            });
            doc.text("ห้องสอบ", x2, headerY, {
                width: colWidth,
                align: "center",
            });
            doc.text("แถว", x3, headerY, {
                width: colWidth,
                align: "center",
            });
            y += rowHeight;
            doc.font(fontNormal).fontSize(12);
            // ===== Data rows =====
            for (const r of rows) {
                // ถ้าเต็มหน้า ให้ขึ้นหน้าใหม่ + วาด header ซ้ำ
                if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
                    doc.addPage();
                    y = doc.page.margins.top;
                    // header ใหม่
                    doc.rect(startX, y, tableWidth, rowHeight).stroke();
                    doc.moveTo(x2, y).lineTo(x2, y + rowHeight).stroke();
                    doc.moveTo(x3, y).lineTo(x3, y + rowHeight).stroke();
                    const hY = y + 4;
                    doc.font(fontBold).fontSize(12);
                    doc.text("เลขประจำตัวที่สอบ", x1, hY, {
                        width: colWidth,
                        align: "center",
                    });
                    doc.text("ห้องสอบ", x2, hY, {
                        width: colWidth,
                        align: "center",
                    });
                    doc.text("แถว", x3, hY, {
                        width: colWidth,
                        align: "center",
                    });
                    doc.font(fontNormal).fontSize(12);
                    y += rowHeight;
                }
                // กรอบแถว
                doc.rect(startX, y, tableWidth, rowHeight).stroke();
                // เส้นกั้น column ในแถวข้อมูล
                doc.moveTo(x2, y).lineTo(x2, y + rowHeight).stroke();
                doc.moveTo(x3, y).lineTo(x3, y + rowHeight).stroke();
                const cellY = y + 4;
                doc.text(r.rangeLabel, x1, cellY, {
                    width: colWidth,
                    align: "center",
                });
                doc.text((_b = r.roomName) !== null && _b !== void 0 ? _b : "-", x2, cellY, {
                    width: colWidth,
                    align: "center",
                });
                doc.text(String(r.rowNo), x3, cellY, {
                    width: colWidth,
                    align: "center",
                });
                y += rowHeight;
            }
            doc.end();
            return pdfPromise;
        });
    }
    static generateSeatPlanNameListPdf(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { campaign_id } = options;
            const info = yield seatplan_repo_1.default.getExamInfoWithSessions(campaign_id);
            if (!info)
                return null;
            // const dayLabels = info.dates.map(d => `${d.getUTCDate()}`);
            const days = info.dates
                .map(d => d.getUTCDate())
                .sort((a, b) => a - b);
            let daysText = "";
            if (days.length === 1) {
                daysText = `${days[0]}`;
            }
            else if (days.length === 2) {
                daysText = `${days[0]} และ ${days[1]}`;
            }
            else {
                daysText =
                    days.slice(0, -1).join(", ") +
                        " และ " +
                        days[days.length - 1];
            }
            //  console.log(dayLabels)
            console.log(info);
            const rows = yield seatplan_repo_1.default.findSeatPlanNameListByCampaign(campaign_id);
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
            /* -------- Header ข้อความด้านบน -------- */
            doc.font(fontNormal).fontSize(14).text("รายชื่อผู้มีสิทธิ์เข้าศึกษาพร้อมที่นั่งสอบและสถานที่สอบ", { align: "center" });
            doc.moveDown(0.2);
            doc.font(fontNormal).fontSize(12).text("ในการสอบคัดเลือกเพื่อบรรจุเป็นข้าราชการอัยการและแต่งตั้งให้ดำรงตำแหน่ง", { align: "center" });
            doc.moveDown(0.2);
            doc.font(fontNormal).fontSize(12).text(`อัยการผู้ช่วย พ.ศ.${info.exam.year_be} (${info.exam.campaign_size})`, { align: "center" });
            doc.moveDown(0.3);
            doc.text(`วันที่ ${daysText}`, { align: "center" });
            doc.moveDown(0.5);
            doc.text(`ณ ${info.exam.site}`, { align: "center" });
            doc.moveDown(0.5);
            doc.text(`รายชื่อผู้มีสิทธิ์เข้าศึกษาพร้อมแผนผังที่นั่งสอบ จำนวน ${rows.length} คน เรียงตามตัวอักษร`, { align: "center" });
            doc.moveDown(1);
            const pageWidth = doc.page.width;
            const { left, right, bottom } = doc.page.margins;
            const tableWidth = pageWidth - left - right;
            // ✅ 6 คอลัมน์: ลำดับ / ชื่อ / เลขประจำตัว / ห้อง / แถว / ลำดับในแถว
            const col1_W = tableWidth * 0.08; // ลำดับ
            const col2_W = tableWidth * 0.38; // ชื่อ-สกุล
            const col3_W = tableWidth * 0.18; // เลขประจำตัวสอบ
            const col4_W = tableWidth * 0.16; // ห้องสอบ
            const col5_W = tableWidth * 0.10; // แถว
            const col6_W = tableWidth - (col1_W + col2_W + col3_W + col4_W + col5_W); // ✅ ที่เหลือ (ลำดับในแถว)
            const startX = left;
            let y = doc.y + 5;
            const headerHeight = 18;
            const rowHeight = 18;
            const x1 = startX;
            const x2 = x1 + col1_W;
            const x3 = x2 + col2_W;
            const x4 = x3 + col3_W;
            const x5 = x4 + col4_W;
            const x6 = x5 + col5_W;
            const x7 = x6 + col6_W; // ขอบขวาสุด
            const drawHeaderRow = () => {
                doc.lineWidth(0.7).strokeColor("black");
                // กรอบหัวตาราง
                doc.rect(startX, y, tableWidth, headerHeight).stroke();
                // เส้นคั่นแนวตั้งหัวตาราง (เพิ่ม x6)
                doc.moveTo(x2, y).lineTo(x2, y + headerHeight).stroke();
                doc.moveTo(x3, y).lineTo(x3, y + headerHeight).stroke();
                doc.moveTo(x4, y).lineTo(x4, y + headerHeight).stroke();
                doc.moveTo(x5, y).lineTo(x5, y + headerHeight).stroke();
                doc.moveTo(x6, y).lineTo(x6, y + headerHeight).stroke(); // ✅ เพิ่ม
                // ไม่ต้องวาด x7 เพราะเป็นขอบกรอบอยู่แล้ว
                const hY = y + 3;
                doc.font(fontBold).fontSize(11);
                doc.text("ลำดับ", x1, hY, { width: col1_W, align: "center" });
                doc.text("ชื่อ - สกุล", x2, hY, { width: col2_W, align: "center" });
                doc.text("เลขประจำตัวสอบ", x3, hY, { width: col3_W, align: "center" });
                doc.text("ห้องสอบ", x4, hY, { width: col4_W, align: "center" });
                doc.text("แถว", x5, hY, { width: col5_W, align: "center" });
                doc.text("ลำดับในแถว", x6, hY, { width: col6_W, align: "center" }); // ✅ คอลัมน์ใหม่
                y += headerHeight;
                doc.font(fontNormal).fontSize(11);
            };
            drawHeaderRow();
            rows.forEach((r, index) => {
                var _a, _b;
                const fullname = `${r.title} ${r.fullName}`;
                // ถ้าเต็มหน้าแล้วขึ้นหน้าใหม่
                if (y + rowHeight > doc.page.height - bottom) {
                    doc.addPage();
                    y = doc.page.margins.top;
                    drawHeaderRow();
                }
                // กรอบแถวเต็มทั้งบรรทัด
                doc.rect(startX, y, tableWidth, rowHeight).stroke();
                // เส้นคั่นแนวตั้งแต่ละคอลัมน์ (เพิ่ม x6)
                doc.moveTo(x2, y).lineTo(x2, y + rowHeight).stroke();
                doc.moveTo(x3, y).lineTo(x3, y + rowHeight).stroke();
                doc.moveTo(x4, y).lineTo(x4, y + rowHeight).stroke();
                doc.moveTo(x5, y).lineTo(x5, y + rowHeight).stroke();
                doc.moveTo(x6, y).lineTo(x6, y + rowHeight).stroke(); // ✅ เพิ่ม
                const cellY = y + 3;
                doc.text(String(index + 1), x1, cellY, { width: col1_W, align: "center" });
                doc.text(fullname, x2 + 4, cellY, { width: col2_W - 8, align: "left" });
                doc.text(r.userCode, x3, cellY, { width: col3_W, align: "center" });
                doc.text((_a = r.roomName) !== null && _a !== void 0 ? _a : "-", x4, cellY, { width: col4_W, align: "center" });
                doc.text(String(r.rowNo), x5, cellY, { width: col5_W, align: "center" });
                doc.text(String((_b = r.colNo) !== null && _b !== void 0 ? _b : "-"), x6, cellY, { width: col6_W, align: "center" }); // ✅ colNo
                y += rowHeight;
            });
            doc.end();
            return pdfPromise;
        });
    }
}
exports.SeatPlanService = SeatPlanService;
