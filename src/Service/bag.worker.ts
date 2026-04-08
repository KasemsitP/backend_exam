import { parentPort, workerData } from "worker_threads";
import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import os from "os";

type PayloadRow = {
  random_num: string | number;
  qr_payload: string | null;
};

type BaseSheetInfo = {
  course?: string;
  org?: string;
  sessionText?: string;
  site?: string;
};

type BagSheetData = {
  bag_no: string | number;
  rows: PayloadRow[];
};

type WorkerTask =
  | "generateBagPayloadPdf"
  | "generateBagPayloadAllPdf";

type WorkerPayload = {
  task: WorkerTask;
  options: {
    info?: BaseSheetInfo;
    bag?: BagSheetData;
    bags?: BagSheetData[];
    outputPath?: string;
  };
};

const chunk = <T>(arr: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );

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
  regular: path.resolve(__dirname, "../../fonts/THSarabunNew.ttf"),
  bold: path.resolve(__dirname, "../../fonts/THSarabunNew-Bold.ttf"),
};

function registerFonts(doc: PDFKit.PDFDocument) {
  doc.registerFont("Sarabun", FONT_PATHS.regular);
  doc.registerFont("SarabunBold", FONT_PATHS.bold);
}

function drawOuterFrame(doc: PDFKit.PDFDocument) {
  doc
    .lineWidth(1)
    .strokeColor("black")
    .rect(
      SHEET.outerX,
      SHEET.outerY,
      SHEET.outerWidth,
      SHEET.outerHeight
    )
    .stroke();
}

function drawHeader(
  doc: PDFKit.PDFDocument,
  info: BaseSheetInfo,
  bagNo: string | number
) {
  const left = 52;
  let y = 30;

  doc.font("SarabunBold").fontSize(16);
  doc.text(`ถุงที่ ${bagNo}`, 0, y, { align: "right" });

  y += 18;

  doc.font("Sarabun").fontSize(14);
  doc.text("ใบกรอกคะแนนวิชา", left, y);
  doc.text(
    "........................................................................",
    left + 72,
    y
  );

  y += 18;
  doc.text("ชื่อ", left, y);
  doc.text("............................", left + 18, y);
  doc.text("เลขรหัส", left + 120, y);
  doc.text("............................", left + 160, y);
  doc.text("ถึง", left + 285, y);
  doc.text("............................", left + 300, y);

  y += 18;
  doc.text("ชื่อผู้ตรวจ", left, y);
  doc.text(
    "........................................................................",
    left + 42,
    y
  );

  y += 18;
  doc.text("ผู้รวบรวมชุดที่", left + 145, y, { width: 120, align: "center" });
  doc.text("................................", left + 235, y);

  const metaParts: string[] = [];
  if (info.course) metaParts.push(`วิชา: ${info.course}`);
  if (info.org) metaParts.push(`${info.org}`);
  if (info.sessionText) metaParts.push(info.sessionText);
  if (info.site) metaParts.push(`ณ ${info.site}`);

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

function drawFooter(doc: PDFKit.PDFDocument) {
  const y = 785;

  doc.font("Sarabun").fontSize(14);
  doc.text("(.................................................................)", 0, y, {
    align: "center",
  });
  doc.text("ลายมือชื่อผู้ตรวจ", 0, y + 14, {
    align: "center",
  });
}

function drawTable(doc: PDFKit.PDFDocument, rows: PayloadRow[]) {
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
    if (!row) continue;

    const y = startY + TABLE.headerHeight + i * TABLE.rowHeight + 4;

    const displayPayload =
      String(row.qr_payload ?? "").length > 85
        ? String(row.qr_payload).slice(0, 85) + "..."
        : String(row.qr_payload ?? "");

    doc.text(String(row.random_num ?? ""), x1 + 4, y, {
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

function addBagPages(
  doc: PDFKit.PDFDocument,
  info: BaseSheetInfo,
  bag: BagSheetData
) {
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

async function writePdf(
  outputPath: string,
  drawFn: (doc: PDFKit.PDFDocument) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
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

    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    drawFn(doc);
    doc.end();

    stream.on("finish", () => resolve(outputPath));
    stream.on("error", reject);
  });
}

async function generateBagPayloadPdf(options: {
  info?: BaseSheetInfo;
  bag: BagSheetData;
  outputPath?: string;
}): Promise<string> {
  const { info = {}, bag } = options;
  const outputPath =
    options.outputPath ||
    path.join(os.tmpdir(), `payload_bag_${bag.bag_no}_${Date.now()}.pdf`);

  return writePdf(outputPath, (doc) => {
    addBagPages(doc, info, bag);
  });
}

async function generateBagPayloadAllPdf(options: {
  info?: BaseSheetInfo;
  bags: BagSheetData[];
  outputPath?: string;
}): Promise<string> {
  const { info = {}, bags } = options;
  const outputPath =
    options.outputPath ||
    path.join(os.tmpdir(), `payload_all_${Date.now()}.pdf`);

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
}

async function runWorkerTask() {
  console.time("⏱️ [Payload Worker] Total Task Time");

  try {
    const { task, options } = workerData as WorkerPayload;

    let filePath: string;

    switch (task) {
      case "generateBagPayloadPdf":
        if (!options?.bag) {
          throw new Error("generateBagPayloadPdf ต้องมี options.bag");
        }
        filePath = await generateBagPayloadPdf({
          info: options.info,
          bag: options.bag,
          outputPath: options.outputPath,
        });
        break;

      case "generateBagPayloadAllPdf":
        if (!options?.bags) {
          throw new Error("generateBagPayloadAllPdf ต้องมี options.bags");
        }
        filePath = await generateBagPayloadAllPdf({
          info: options.info,
          bags: options.bags,
          outputPath: options.outputPath,
        });
        break;

      default:
        throw new Error(`Unknown task: ${task}`);
    }

    console.timeEnd("⏱️ [Payload Worker] Total Task Time");
    parentPort?.postMessage({ status: "success", filePath });
  } catch (error: any) {
    console.timeEnd("⏱️ [Payload Worker] Total Task Time");
    parentPort?.postMessage({
      status: "error",
      message: String(error?.message || error),
    });
  }
}

runWorkerTask();