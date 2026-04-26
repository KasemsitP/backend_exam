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
const chunk = (arr, size) => {
    if (size <= 0)
        return [arr];
    return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));
};
const PAGE = {
    width: 595.28,
    height: 841.89,
    marginLeft: 20,
    marginRight: 20,
    marginTop: 18,
    marginBottom: 18,
};
const SHEET = {
    outerX: 14,
    outerY: 16,
    outerWidth: 567,
    outerHeight: 809,
};
const TABLE = {
    x: 34,
    y: 128, // จาก 142 -> 128
    width: 527,
    headerHeight: 22,
    rowHeight: 18.2,
};
const FOOTER = {
    lineY: 770,
    textY: 785,
};
const MIN_ROWS = 30;
const FONT_PATHS = {
    regular: path_1.default.resolve(__dirname, "../../fonts/THSarabunNew.ttf"),
    bold: path_1.default.resolve(__dirname, "../../fonts/THSarabunNew-Bold.ttf"),
};
function registerFonts(doc) {
    doc.registerFont("Sarabun", FONT_PATHS.regular);
    doc.registerFont("SarabunBold", FONT_PATHS.bold);
}
function drawOuterFrame(doc) {
    doc
        .lineWidth(0.9)
        .strokeColor("black")
        .rect(SHEET.outerX, SHEET.outerY, SHEET.outerWidth, SHEET.outerHeight)
        .stroke();
}
function dottedLine(doc, x, y, width) {
    doc
        .moveTo(x, y)
        .lineTo(x + width, y)
        .dash(1, { space: 1.4 })
        .stroke()
        .undash();
}
/**
 * คำนวณจำนวนแถวที่ใส่ได้จริงใน 1 หน้า
 * ไม่ใช้ rowsPerPage แบบ fix แล้ว
 */
function getRowsPerPage() {
    const availableHeight = FOOTER.lineY - TABLE.y; // เอา -10 ออก
    const usableBodyHeight = availableHeight - TABLE.headerHeight;
    const rowsPerPage = Math.floor(usableBodyHeight / TABLE.rowHeight);
    return Math.max(rowsPerPage, 1);
}
function getTableHeight(rowsPerPage) {
    return TABLE.headerHeight + rowsPerPage * TABLE.rowHeight;
}
function drawHeader(doc, info, bagNo) {
    let y = 32;
    // มุมบน (แต่จะกลายเป็นกลาง)
    doc.font("SarabunBold").fontSize(25);
    doc.text(`ถุงที่ ${bagNo}`, 0, y, { align: "right" });
    // บรรทัด 1
    y += 16;
    doc.font("Sarabun").fontSize(12.5);
    doc.text(`ใบกรอกคะแนนวิชา ${info.course || ""}`, 0, y, {
        align: "center",
    });
    // บรรทัด 2
    y += 16;
    doc.text(`ข้อที่ ${info.question_no || ""}   เลขรหัส ${info.start_num || ""}   ถึง ${info.end_num || ""}`, 0, y, { align: "center" });
    // บรรทัด 3
    y += 16;
    doc.text(`ชื่อผู้ตรวจ ${info.full_name || ""}`, 0, y, {
        align: "center",
    });
    // บรรทัด 4
    y += 16;
    doc.text(`ผู้ตรวจคนที่ ${info.grader_order || ""}`, 0, y, {
        align: "center",
    });
}
function drawFooter(doc) {
    doc.font("Sarabun").fontSize(12.5);
    doc.text("(........................................................)", 20, FOOTER.lineY, {
        align: "center",
    });
    doc.text("ลายมือชื่อผู้ตรวจ", 20, FOOTER.textY, {
        align: "center",
    });
}
function drawTable(doc, rows) {
    var _a, _b;
    const rowsPerPage = getRowsPerPage();
    const tableX = TABLE.x;
    const startY = TABLE.y;
    const tableWidth = TABLE.width;
    const tableHeight = TABLE.headerHeight + rows.length * TABLE.rowHeight;
    // 3 columns: เลขที่ | Payload | คะแนน
    const colNoWidth = 95;
    const colScoreWidth = 85;
    const colPayloadWidth = tableWidth - colNoWidth - colScoreWidth;
    const x1 = tableX;
    const x2 = x1 + colNoWidth;
    const x3 = x2 + colPayloadWidth;
    const x4 = x1 + tableWidth;
    doc.lineWidth(0.65).strokeColor("black").fillColor("black");
    // กรอบนอก
    doc.rect(x1, startY, tableWidth, tableHeight).stroke();
    // เส้นตั้ง
    doc.moveTo(x2, startY).lineTo(x2, startY + tableHeight).stroke();
    doc.moveTo(x3, startY).lineTo(x3, startY + tableHeight).stroke();
    // เส้นหัวตาราง
    doc
        .moveTo(x1, startY + TABLE.headerHeight)
        .lineTo(x4, startY + TABLE.headerHeight)
        .stroke();
    // เส้นแนวนอน
    const actualRows = rows.length;
    for (let i = 1; i <= actualRows; i++) {
        const y = startY + TABLE.headerHeight + i * TABLE.rowHeight;
        doc.moveTo(x1, y).lineTo(x4, y).stroke();
    }
    // หัวตาราง
    doc.font("SarabunBold").fontSize(11.5);
    doc.text("ลำดับจัดเก็บ", x1, startY + 4, {
        width: colNoWidth,
        align: "center",
    });
    doc.text("Payload", x2, startY + 4, {
        width: colPayloadWidth,
        align: "center",
    });
    doc.text("คะแนน", x3, startY + 4, {
        width: colScoreWidth,
        align: "center",
    });
    // ข้อมูล
    doc.font("Sarabun").fontSize(8.2);
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row)
            continue;
        const y = startY + TABLE.headerHeight + i * TABLE.rowHeight + 4;
        const scoreText = row.score === null || row.score === undefined || row.score === ""
            ? ""
            : String(row.score);
        const payloadText = String((_a = row.qr_payload) !== null && _a !== void 0 ? _a : "");
        const displayPayload = payloadText.length > 72 ? payloadText.slice(0, 72) + "..." : payloadText;
        doc.text(String((_b = row.random_num) !== null && _b !== void 0 ? _b : ""), x1 + 3, y, {
            width: colNoWidth - 6,
            align: "center",
            lineBreak: false,
        });
        doc.text(displayPayload, x2 + 4, y, {
            width: colPayloadWidth - 8,
            align: "left",
            lineBreak: false,
            ellipsis: true,
        });
        doc.text(scoreText, x3 + 3, y, {
            width: colScoreWidth - 6,
            align: "center",
            lineBreak: false,
        });
    }
}
function addBagPages(doc, bag) {
    const rowsPerPage = getRowsPerPage();
    const pages = chunk(bag.rows, rowsPerPage);
    const safePages = pages.length > 0 ? pages : [[]];
    for (const rawPageRows of safePages) {
        const pageRows = [...rawPageRows];
        while (pageRows.length < MIN_ROWS) {
            pageRows.push({
                random_num: "",
                qr_payload: "",
                score: "",
            });
        }
        doc.addPage();
        //drawOuterFrame(doc);
        drawHeader(doc, bag.info, bag.bag_no);
        drawTable(doc, pageRows);
        drawFooter(doc);
    }
}
function writePdf(outputPath, drawFn) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            const doc = new pdfkit_1.default({
                size: "A4",
                margins: {
                    top: PAGE.marginTop,
                    bottom: PAGE.marginBottom,
                    left: PAGE.marginLeft,
                    right: PAGE.marginRight,
                },
                autoFirstPage: false,
                bufferPages: false,
            });
            registerFonts(doc);
            const stream = fs_1.default.createWriteStream(outputPath);
            doc.pipe(stream);
            drawFn(doc);
            doc.end();
            stream.on("finish", () => resolve(outputPath));
            stream.on("error", reject);
        });
    });
}
// ============== Manual PDF (ทุกข้อในใบเดียว, ไม่ใส่คะแนน) ==============
function truncatePayloadFor(doc, payload, maxWidth) {
    if (!payload)
        return "";
    if (doc.widthOfString(payload) <= maxWidth)
        return payload;
    if (payload.length <= 8)
        return payload;
    // return payload.slice(0, 4) + "........................" + payload.slice(-4);
    return payload.slice(0, 60) + "...";
}
function drawManualHeader(doc, info, bagNo, questions) {
    var _a, _b, _c, _d, _e;
    let y = 32;
    doc.font("SarabunBold").fontSize(25);
    doc.text(`ถุงที่ ${bagNo}`, 0, y, { align: "right" });
    // บรรทัด 1
    y += 16;
    doc.font("Sarabun").fontSize(12.5);
    doc.text(`ใบกรอกคะแนนวิชา ${info.course || ""}`, 0, y, { align: "center" });
    // บรรทัด 2 — ข้อที่ 1-N เลขรหัส X ถึง Y
    y += 16;
    const firstQ = (_b = (_a = questions[0]) === null || _a === void 0 ? void 0 : _a.question_no) !== null && _b !== void 0 ? _b : "";
    const lastQ = (_d = (_c = questions[questions.length - 1]) === null || _c === void 0 ? void 0 : _c.question_no) !== null && _d !== void 0 ? _d : "";
    const qRange = questions.length === 0
        ? ""
        : firstQ === lastQ
            ? String(firstQ)
            : `${firstQ}-${lastQ}`;
    doc.text(`ข้อที่ ${qRange}   เลขรหัส ${info.start_num || ""}   ถึง ${info.end_num || ""}`, 0, y, { align: "center" });
    // บรรทัด 3 — ชื่อผู้ตรวจ
    y += 16;
    doc.text(`ชื่อผู้ตรวจ ${info.full_name || ""}`, 0, y, { align: "center" });
    // บรรทัด 4 — ผู้ตรวจคนที่
    y += 16;
    doc.text(`ผู้ตรวจคนที่ ${(_e = info.grader_order) !== null && _e !== void 0 ? _e : ""}`, 0, y, { align: "center" });
}
// function drawManualTable(
//   doc: PDFKit.PDFDocument,
//   rows: ManualPayloadRow[],
//   questions: ManualQuestion[]
// ) {
//   const tableX = TABLE.x;
//   const startY = TABLE.y;
//   const tableWidth = TABLE.width;
//   const tableHeight = TABLE.headerHeight + rows.length * TABLE.rowHeight;
//   const colNoWidth = 70;
//   const qCount = Math.max(questions.length, 1);
//   // ความกว้างคอลัมน์ข้อ — ขั้นต่ำ 28, สูงสุด 60
//   const desiredQWidth = Math.max(28, Math.min(60, Math.floor((tableWidth - colNoWidth) / (qCount + 4))));
//   const totalQWidth = desiredQWidth * qCount;
//   const colPayloadWidth = tableWidth - colNoWidth - totalQWidth;
//   const x1 = tableX;
//   const x2 = x1 + colNoWidth;
//   const x3 = x2 + colPayloadWidth;
//   const xEnd = x1 + tableWidth;
//   doc.lineWidth(0.65).strokeColor("black").fillColor("black");
//   // กรอบนอก
//   doc.rect(x1, startY, tableWidth, tableHeight).stroke();
//   // เส้นตั้ง: ลำดับ | payload | (ข้อ 1 | ข้อ 2 | ...)
//   doc.moveTo(x2, startY).lineTo(x2, startY + tableHeight).stroke();
//   doc.moveTo(x3, startY).lineTo(x3, startY + tableHeight).stroke();
//   for (let i = 1; i < qCount; i++) {
//     const xq = x3 + i * desiredQWidth;
//     doc.moveTo(xq, startY).lineTo(xq, startY + tableHeight).stroke();
//   }
//   // เส้นใต้หัวตาราง
//   doc
//     .moveTo(x1, startY + TABLE.headerHeight)
//     .lineTo(xEnd, startY + TABLE.headerHeight)
//     .stroke();
//   // เส้นแนวนอน body
//   for (let i = 1; i <= rows.length; i++) {
//     const y = startY + TABLE.headerHeight + i * TABLE.rowHeight;
//     doc.moveTo(x1, y).lineTo(xEnd, y).stroke();
//   }
//   // หัวตาราง
//   doc.font("SarabunBold").fontSize(11);
//   doc.text("ลำดับจัดเก็บ", x1, startY + 4, {
//     width: colNoWidth,
//     align: "center",
//   });
//   doc.text("Payload", x2, startY + 4, {
//     width: colPayloadWidth,
//     align: "center",
//   });
//   doc.fontSize(9);
//   for (let i = 0; i < qCount; i++) {
//     const q = questions[i];
//     const xq = x3 + i * desiredQWidth;
//     const labelText = q?.label
//       ? `ข้อ ${q.question_no}\n${q.label}`
//       : `ข้อ ${q?.question_no ?? i + 1}`;
//     doc.text(labelText, xq + 1, startY + 3, {
//       width: desiredQWidth - 2,
//       align: "center",
//       lineGap: 0,
//       ellipsis: true,
//     });
//   }
//   // body
//   doc.font("Sarabun").fontSize(8.2);
//   for (let i = 0; i < rows.length; i++) {
//     const row = rows[i];
//     if (!row) continue;
//     const y = startY + TABLE.headerHeight + i * TABLE.rowHeight + 4;
//     doc.text(String(row.random_num ?? ""), x1 + 3, y, {
//       width: colNoWidth - 6,
//       align: "center",
//       lineBreak: false,
//     });
//     const payloadText = String(row.qr_payload ?? "");
//     const display = truncatePayloadFor(doc, payloadText, colPayloadWidth - 8);
//     doc.text(display, x2 + 4, y, {
//       width: colPayloadWidth - 8,
//       align: "left",
//       lineBreak: false,
//       ellipsis: true,
//     });
//   }
// }
function shortText(text, max = 18) {
    if (!text)
        return "";
    return text.length > max ? text.slice(0, max) + "..." : text;
}
function drawManualTableV2(doc, rows, questions) {
    var _a, _b, _c;
    const tableX = 34;
    const startY = 130;
    const tableWidth = 527;
    const headerH1 = 24;
    const headerH2 = 22;
    const rowH = 18.2;
    const tableHeight = headerH1 + headerH2 + rows.length * rowH;
    const qCount = Math.max(questions.length, 1);
    const colNoWidth = 70;
    const colPayloadWidth = 210;
    const remainWidth = tableWidth - colNoWidth - colPayloadWidth;
    const qWidth = remainWidth / qCount;
    const xNo = tableX;
    const xPayload = xNo + colNoWidth;
    const xQuestion = xPayload + colPayloadWidth;
    const xEnd = tableX + tableWidth;
    doc.lineWidth(0.55).strokeColor("black").fillColor("black");
    // outer border
    doc.rect(tableX, startY, tableWidth, tableHeight).stroke();
    // vertical main lines
    doc.moveTo(xPayload, startY).lineTo(xPayload, startY + tableHeight).stroke();
    doc.moveTo(xQuestion, startY).lineTo(xQuestion, startY + tableHeight).stroke();
    // question vertical lines
    for (let i = 1; i < qCount; i++) {
        const x = xQuestion + i * qWidth;
        doc
            .moveTo(x, startY + headerH1)
            .lineTo(x, startY + tableHeight)
            .stroke();
    }
    // header horizontal lines
    doc
        .moveTo(xQuestion, startY + headerH1)
        .lineTo(xEnd, startY + headerH1)
        .stroke();
    doc
        .moveTo(tableX, startY + headerH1 + headerH2)
        .lineTo(xEnd, startY + headerH1 + headerH2)
        .stroke();
    // body horizontal lines
    for (let i = 1; i <= rows.length; i++) {
        const y = startY + headerH1 + headerH2 + i * rowH;
        doc.moveTo(tableX, y).lineTo(xEnd, y).stroke();
    }
    // header text
    doc.font("SarabunBold").fontSize(11);
    doc.text("ลำดับจัดเก็บ", xNo, startY + 15, {
        width: colNoWidth,
        align: "center",
    });
    doc.text("Payload", xPayload, startY + 15, {
        width: colPayloadWidth,
        align: "center",
    });
    doc.text("คะแนนรายข้อ", xQuestion, startY + 5, {
        width: remainWidth,
        align: "center",
    });
    // question headers
    doc.font("SarabunBold").fontSize(8.5);
    for (let i = 0; i < qCount; i++) {
        const q = questions[i];
        const x = xQuestion + i * qWidth;
        doc.text(`ข้อ ${(_a = q === null || q === void 0 ? void 0 : q.question_no) !== null && _a !== void 0 ? _a : i + 1}`, x + 2, startY + headerH1 + 2, {
            width: qWidth - 4,
            align: "center",
            lineBreak: false,
        });
        // doc.font("Sarabun").fontSize(7.2);
        // doc.text(shortText(q?.label, 16), x + 2, startY + headerH1 + 12, {
        //   width: qWidth - 4,
        //   align: "center",
        //   lineBreak: false,
        //   ellipsis: true,
        // });
        doc.font("SarabunBold").fontSize(8.5);
    }
    // body
    doc.font("Sarabun").fontSize(8.2);
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const y = startY + headerH1 + headerH2 + i * rowH + 4;
        doc.text(String((_b = row.random_num) !== null && _b !== void 0 ? _b : ""), xNo + 3, y, {
            width: colNoWidth - 6,
            align: "center",
            lineBreak: false,
        });
        const payload = String((_c = row.qr_payload) !== null && _c !== void 0 ? _c : "");
        const displayPayload = truncatePayloadFor(doc, payload, colPayloadWidth - 8);
        doc.text(displayPayload, xPayload + 4, y, {
            width: colPayloadWidth - 8,
            align: "left",
            lineBreak: false,
            ellipsis: true,
        });
    }
}
function addBagManualPages(doc, bag) {
    const rowsPerPage = getManualRowsPerPage();
    const pages = chunk(bag.rows, rowsPerPage);
    const safePages = pages.length > 0 ? pages : [[]];
    for (const rawPageRows of safePages) {
        const pageRows = [...rawPageRows];
        while (pageRows.length < MIN_ROWS) {
            pageRows.push({
                random_num: "",
                qr_payload: "",
            });
        }
        doc.addPage();
        drawManualHeader(doc, bag.info, bag.bag_no, bag.questions);
        drawManualTableV2(doc, pageRows, bag.questions);
        drawFooter(doc);
    }
}
function getManualRowsPerPage() {
    const manualHeaderHeight = 24 + 22;
    const availableHeight = FOOTER.lineY - 130;
    const usableBodyHeight = availableHeight - manualHeaderHeight;
    return Math.max(Math.floor(usableBodyHeight / TABLE.rowHeight), 1);
}
function generateBagManualPayloadPdf(options) {
    return __awaiter(this, void 0, void 0, function* () {
        const { manualBag } = options;
        const outputPath = options.outputPath ||
            path_1.default.join(os_1.default.tmpdir(), `manual_bag_${manualBag.bag_no}_${Date.now()}.pdf`);
        return writePdf(outputPath, (doc) => {
            addBagManualPages(doc, manualBag);
        });
    });
}
function generateBagPayloadPdf(options) {
    return __awaiter(this, void 0, void 0, function* () {
        const { bag } = options;
        const outputPath = options.outputPath ||
            path_1.default.join(os_1.default.tmpdir(), `payload_bag_${bag.bag_no}_${Date.now()}.pdf`);
        return writePdf(outputPath, (doc) => {
            addBagPages(doc, bag);
        });
    });
}
function generateBagPayloadAllPdf(options) {
    return __awaiter(this, void 0, void 0, function* () {
        const { bags } = options;
        const outputPath = options.outputPath ||
            path_1.default.join(os_1.default.tmpdir(), `payload_all_${Date.now()}.pdf`);
        return writePdf(outputPath, (doc) => {
            if (!bags || bags.length === 0) {
                doc.addPage();
                // drawOuterFrame(doc);
                drawHeader(doc, {}, "-");
                drawTable(doc, []);
                drawFooter(doc);
                return;
            }
            for (const bag of bags) {
                addBagPages(doc, bag);
            }
        });
    });
}
function runWorkerTask() {
    return __awaiter(this, void 0, void 0, function* () {
        console.time("⏱️ [Payload Worker] Total Task Time");
        try {
            const { task, options } = worker_threads_1.workerData;
            let filePath;
            switch (task) {
                case "generateBagPayloadPdf":
                    if (!(options === null || options === void 0 ? void 0 : options.bag)) {
                        throw new Error("generateBagPayloadPdf ต้องมี options.bag");
                    }
                    filePath = yield generateBagPayloadPdf({
                        bag: options.bag,
                        outputPath: options.outputPath,
                    });
                    break;
                case "generateBagPayloadAllPdf":
                    if (!(options === null || options === void 0 ? void 0 : options.bags)) {
                        throw new Error("generateBagPayloadAllPdf ต้องมี options.bags");
                    }
                    filePath = yield generateBagPayloadAllPdf({
                        bags: options.bags,
                        outputPath: options.outputPath,
                    });
                    break;
                case "generateBagManualPayloadPdf":
                    if (!(options === null || options === void 0 ? void 0 : options.manualBag)) {
                        throw new Error("generateBagManualPayloadPdf ต้องมี options.manualBag");
                    }
                    filePath = yield generateBagManualPayloadPdf({
                        manualBag: options.manualBag,
                        outputPath: options.outputPath,
                    });
                    break;
                default:
                    throw new Error(`Unknown task: ${task}`);
            }
            console.timeEnd("⏱️ [Payload Worker] Total Task Time");
            worker_threads_1.parentPort === null || worker_threads_1.parentPort === void 0 ? void 0 : worker_threads_1.parentPort.postMessage({ status: "success", filePath });
        }
        catch (error) {
            console.timeEnd("⏱️ [Payload Worker] Total Task Time");
            worker_threads_1.parentPort === null || worker_threads_1.parentPort === void 0 ? void 0 : worker_threads_1.parentPort.postMessage({
                status: "error",
                message: String((error === null || error === void 0 ? void 0 : error.message) || error),
            });
        }
    });
}
runWorkerTask();
