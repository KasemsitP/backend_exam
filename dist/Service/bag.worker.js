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
const LAYOUT = {
    contentLeft: 40,
    contentRight: 40,
    headerTop: 30,
    footerHeight: 48,
    footerBottomGap: 14,
    sectionGap: 10,
};
const TABLE = {
    headerHeight: 22,
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
function getTableRowHeight(doc, tableStartY) {
    const footerTopY = SHEET.outerY + SHEET.outerHeight - LAYOUT.footerHeight - LAYOUT.footerBottomGap;
    const availableHeight = footerTopY - tableStartY;
    const rowHeight = (availableHeight - TABLE.headerHeight) / TABLE.rowsPerPage;
    return {
        footerTopY,
        availableHeight,
        rowHeight,
        tableHeight: TABLE.headerHeight + rowHeight * TABLE.rowsPerPage,
    };
}
function drawHeader(doc, info, bagNo) {
    var _a, _b, _c, _d;
    const pageWidth = doc.page.width;
    const marginX = 52;
    const labelX = marginX;
    const valueX = marginX + 80;
    let y = LAYOUT.headerTop;
    doc.font("SarabunBold").fontSize(22);
    doc.text(`ถุงที่ ${bagNo}`, 0, y, { align: "right" });
    y += 20;
    doc.font("SarabunBold").fontSize(18);
    doc.text("ใบสรุปข้อมูลถุงจัดเก็บข้อสอบ", marginX, y, {
        width: doc.page.width - marginX * 2,
        align: "center",
    });
    y += 30;
    doc.font("Sarabun").fontSize(15);
    doc.text("รอบสอบ :", labelX, y);
    doc.text((_a = info.org) !== null && _a !== void 0 ? _a : "-", valueX, y);
    y += 18;
    doc.text("วิชา :", labelX, y);
    doc.text((_b = info.course) !== null && _b !== void 0 ? _b : "-", valueX, y);
    y += 18;
    const startText = (_c = info.start_num) !== null && _c !== void 0 ? _c : "-";
    const toText = "ถึง";
    const endText = (_d = info.end_num) !== null && _d !== void 0 ? _d : "-";
    doc.text("ลำดับจัดเก็บ :", labelX, y);
    let x = valueX;
    // start
    doc.text(startText, x, y);
    x += doc.widthOfString(startText) + 10; // gap เล็ก ๆ
    // ถึง
    doc.text(toText, x, y);
    x += doc.widthOfString(toText) + 10;
    // end
    doc.text(endText, x, y);
    if (info.site) {
        y += 18;
        doc.text("สถานที่ :", labelX, y);
        doc.text(info.site, valueX, y);
    }
    // const metaParts: string[] = [];
    // if (info.org) metaParts.push(info.org);
    // if (info.sessionText) metaParts.push(info.sessionText);
    // if (info.site) metaParts.push(`ณ ${info.site}`);
    // if (metaParts.length > 0) {
    //   y += 20;
    //   doc.font("Sarabun").fontSize(10).fillColor("#666666");
    //   doc.text(metaParts.join("   |   "), marginX, y, {
    //     width: pageWidth - marginX * 2,
    //     align: "center",
    //   });
    //   doc.fillColor("black");
    // }
    return y + LAYOUT.sectionGap + 18;
}
function drawFooter(doc) {
    const footerTopY = SHEET.outerY + SHEET.outerHeight - LAYOUT.footerHeight - LAYOUT.footerBottomGap;
    // doc.font("Sarabun").fontSize(14);
    // doc.text("(.................................................................)", 0, footerTopY, {
    //   align: "center",
    // });
    // doc.text("ลายมือชื่อผู้ตรวจ", 0, footerTopY + 14, {
    //   align: "center",
    // });
}
function drawTable(doc, rows, startY) {
    var _a, _b;
    const tableX = LAYOUT.contentLeft;
    const tableWidth = doc.page.width - LAYOUT.contentLeft - LAYOUT.contentRight;
    const colNoWidth = 70;
    const colPayloadWidth = tableWidth - colNoWidth;
    const x1 = tableX;
    const x2 = x1 + colNoWidth;
    const x3 = x1 + tableWidth;
    const { rowHeight, tableHeight } = getTableRowHeight(doc, startY);
    doc.lineWidth(0.7).strokeColor("black").fillColor("black");
    // Outer border
    doc.rect(x1, startY, tableWidth, tableHeight).stroke();
    // Vertical separator
    doc.moveTo(x2, startY).lineTo(x2, startY + tableHeight).stroke();
    // Header separator
    doc
        .moveTo(x1, startY + TABLE.headerHeight)
        .lineTo(x3, startY + TABLE.headerHeight)
        .stroke();
    // Row lines
    for (let i = 1; i <= TABLE.rowsPerPage; i++) {
        const y = startY + TABLE.headerHeight + i * rowHeight;
        doc.moveTo(x1, y).lineTo(x3, y).stroke();
    }
    // Header text
    doc.font("SarabunBold").fontSize(13);
    doc.text("เลขที่", x1, startY + 4, {
        width: colNoWidth,
        align: "center",
    });
    doc.text("Payload", x2, startY + 4, {
        width: colPayloadWidth,
        align: "center",
    });
    // Body text
    doc.font("Sarabun").fontSize(10);
    for (let i = 0; i < TABLE.rowsPerPage; i++) {
        const row = rows[i];
        if (!row)
            continue;
        const y = startY + TABLE.headerHeight + i * rowHeight + 3;
        const payloadText = String((_a = row.qr_payload) !== null && _a !== void 0 ? _a : "");
        doc.text(String((_b = row.random_num) !== null && _b !== void 0 ? _b : ""), x1 + 3, y, {
            width: colNoWidth - 6,
            align: "center",
            lineBreak: false,
        });
        doc.text(payloadText, x2 + 5, y, {
            width: colPayloadWidth - 10,
            align: "left",
            lineBreak: false,
            ellipsis: true,
        });
    }
}
function addBagPages(doc, bag) {
    const pages = chunk(bag.rows, TABLE.rowsPerPage);
    const safePages = pages.length > 0 ? pages : [[]];
    for (const pageRows of safePages) {
        doc.addPage();
        //drawOuterFrame(doc);
        const tableStartY = drawHeader(doc, bag.info, bag.bag_no);
        drawTable(doc, pageRows, tableStartY);
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
                //  drawOuterFrame(doc);
                const tableStartY = drawHeader(doc, {}, "-");
                drawTable(doc, [], tableStartY);
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
