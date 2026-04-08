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
const chunk = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));
const PAGE = {
    width: 595.28,
    height: 841.89,
    marginLeft: 25,
    marginRight: 25,
    marginTop: 28,
    marginBottom: 28,
};
const SHEET = {
    outerX: 15,
    outerY: 18,
    outerWidth: 565,
    outerHeight: 805,
};
const TABLE = {
    x: 40,
    width: 500,
    headerHeight: 24,
    rowHeight: 22,
    rowsPerPage: 30,
};
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
        .lineWidth(1)
        .strokeColor("black")
        .rect(SHEET.outerX, SHEET.outerY, SHEET.outerWidth, SHEET.outerHeight)
        .stroke();
}
function drawHeader(doc, info, bagNo) {
    const left = 52;
    let y = 30;
    doc.font("SarabunBold").fontSize(16);
    doc.text(`ถุงที่ ${bagNo}`, 0, y, { align: "right" });
    y += 18;
    doc.font("Sarabun").fontSize(14);
    doc.text("ใบกรอกคะแนนวิชา", left, y);
    doc.text("........................................................................", left + 72, y);
    y += 18;
    doc.text("ชื่อ", left, y);
    doc.text("............................", left + 18, y);
    doc.text("เลขรหัส", left + 120, y);
    doc.text("............................", left + 160, y);
    doc.text("ถึง", left + 285, y);
    doc.text("............................", left + 300, y);
    y += 18;
    doc.text("ชื่อผู้ตรวจ", left, y);
    doc.text("........................................................................", left + 42, y);
    y += 18;
    doc.text("ผู้รวบรวมชุดที่", left + 145, y, { width: 120, align: "center" });
    doc.text("................................", left + 235, y);
    const metaParts = [];
    if (info.course)
        metaParts.push(`วิชา: ${info.course}`);
    if (info.org)
        metaParts.push(`${info.org}`);
    if (info.sessionText)
        metaParts.push(info.sessionText);
    if (info.site)
        metaParts.push(`ณ ${info.site}`);
    if (metaParts.length > 0) {
        y += 16;
        doc.font("Sarabun").fontSize(10).fillColor("#666666");
        doc.text(metaParts.join("   |   "), left, y, {
            width: 460,
            align: "center",
        });
        doc.fillColor("black");
    }
}
function drawFooter(doc) {
    const y = 785;
    doc.font("Sarabun").fontSize(14);
    doc.text("(.................................................................)", 0, y, {
        align: "center",
    });
    doc.text("ลายมือชื่อผู้ตรวจ", 0, y + 14, {
        align: "center",
    });
}
function drawTable(doc, rows) {
    var _a, _b, _c;
    const tableX = TABLE.x;
    const startY = 132;
    const tableWidth = TABLE.width;
    const col1 = 95;
    const col2 = tableWidth - col1;
    const x1 = tableX;
    const x2 = x1 + col1;
    const x3 = x1 + tableWidth;
    const tableHeight = TABLE.headerHeight + TABLE.rowsPerPage * TABLE.rowHeight;
    doc.lineWidth(0.7).strokeColor("black").fillColor("black");
    doc.rect(x1, startY, tableWidth, tableHeight).stroke();
    doc.moveTo(x2, startY).lineTo(x2, startY + tableHeight).stroke();
    doc
        .moveTo(x1, startY + TABLE.headerHeight)
        .lineTo(x3, startY + TABLE.headerHeight)
        .stroke();
    for (let i = 1; i <= TABLE.rowsPerPage; i++) {
        const y = startY + TABLE.headerHeight + i * TABLE.rowHeight;
        doc.moveTo(x1, y).lineTo(x3, y).stroke();
    }
    doc.font("SarabunBold").fontSize(13);
    doc.text("เลขที่", x1, startY + 5, {
        width: col1,
        align: "center",
    });
    doc.text("payload", x2, startY + 5, {
        width: col2,
        align: "center",
    });
    doc.font("Sarabun").fontSize(11);
    for (let i = 0; i < TABLE.rowsPerPage; i++) {
        const row = rows[i];
        if (!row)
            continue;
        const y = startY + TABLE.headerHeight + i * TABLE.rowHeight + 4;
        const displayPayload = String((_a = row.qr_payload) !== null && _a !== void 0 ? _a : "").length > 85
            ? String(row.qr_payload).slice(0, 85) + "..."
            : String((_b = row.qr_payload) !== null && _b !== void 0 ? _b : "");
        doc.text(String((_c = row.random_num) !== null && _c !== void 0 ? _c : ""), x1 + 4, y, {
            width: col1 - 8,
            align: "center",
        });
        doc.text(displayPayload, x2 + 6, y, {
            width: col2 - 12,
            align: "left",
            lineBreak: false,
            ellipsis: true,
        });
    }
}
function addBagPages(doc, info, bag) {
    const pages = chunk(bag.rows, TABLE.rowsPerPage);
    const safePages = pages.length > 0 ? pages : [[]];
    for (const pageRows of safePages) {
        doc.addPage();
        drawOuterFrame(doc);
        drawHeader(doc, info, bag.bag_no);
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
function generateBagPayloadPdf(options) {
    return __awaiter(this, void 0, void 0, function* () {
        const { info = {}, bag } = options;
        const outputPath = options.outputPath ||
            path_1.default.join(os_1.default.tmpdir(), `payload_bag_${bag.bag_no}_${Date.now()}.pdf`);
        return writePdf(outputPath, (doc) => {
            addBagPages(doc, info, bag);
        });
    });
}
function generateBagPayloadAllPdf(options) {
    return __awaiter(this, void 0, void 0, function* () {
        const { info = {}, bags } = options;
        const outputPath = options.outputPath ||
            path_1.default.join(os_1.default.tmpdir(), `payload_all_${Date.now()}.pdf`);
        return writePdf(outputPath, (doc) => {
            if (!bags || bags.length === 0) {
                doc.addPage();
                drawOuterFrame(doc);
                drawHeader(doc, info, "-");
                drawTable(doc, []);
                drawFooter(doc);
                return;
            }
            for (const bag of bags) {
                addBagPages(doc, info, bag);
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
                        info: options.info,
                        bag: options.bag,
                        outputPath: options.outputPath,
                    });
                    break;
                case "generateBagPayloadAllPdf":
                    if (!(options === null || options === void 0 ? void 0 : options.bags)) {
                        throw new Error("generateBagPayloadAllPdf ต้องมี options.bags");
                    }
                    filePath = yield generateBagPayloadAllPdf({
                        info: options.info,
                        bags: options.bags,
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
