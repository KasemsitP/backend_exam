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
