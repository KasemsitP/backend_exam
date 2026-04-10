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
  start_num?: string;
  end_num?: string;
};

type BagPayloadPdfData = {
  bag_no: string | number;
  info: BaseSheetInfo;
  rows: PayloadRow[];
};

type WorkerTask =
  | "generateBagPayloadPdf"
  | "generateBagPayloadAllPdf";

type WorkerPayload = {
  task: WorkerTask;
  options: {
    info?: BaseSheetInfo;
    bag?: BagPayloadPdfData;
    bags?: BagPayloadPdfData[];
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

function getTableRowHeight(doc: PDFKit.PDFDocument, tableStartY: number) {
  const footerTopY =
    SHEET.outerY + SHEET.outerHeight - LAYOUT.footerHeight - LAYOUT.footerBottomGap;

  const availableHeight = footerTopY - tableStartY;
  const rowHeight =
    (availableHeight - TABLE.headerHeight) / TABLE.rowsPerPage;

  return {
    footerTopY,
    availableHeight,
    rowHeight,
    tableHeight: TABLE.headerHeight + rowHeight * TABLE.rowsPerPage,
  };
}

function drawHeader(
  doc: PDFKit.PDFDocument,
  info: BaseSheetInfo,
  bagNo: string | number
): number {
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
  doc.text(info.org ?? "-", valueX, y);


  y += 18;
  
  doc.text("วิชา :", labelX, y);
  doc.text(info.course ?? "-", valueX, y);



  y += 18;

  const startText = info.start_num ?? "-";
  const toText = "ถึง";
  const endText = info.end_num ?? "-";

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

function drawFooter(doc: PDFKit.PDFDocument) {
  const footerTopY =
    SHEET.outerY + SHEET.outerHeight - LAYOUT.footerHeight - LAYOUT.footerBottomGap;

  // doc.font("Sarabun").fontSize(14);
  // doc.text("(.................................................................)", 0, footerTopY, {
  //   align: "center",
  // });
  // doc.text("ลายมือชื่อผู้ตรวจ", 0, footerTopY + 14, {
  //   align: "center",
  // });
}

function drawTable(
  doc: PDFKit.PDFDocument,
  rows: PayloadRow[],
  startY: number
) {
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
    if (!row) continue;

    const y = startY + TABLE.headerHeight + i * rowHeight + 3;

    const payloadText = String(row.qr_payload ?? "");

    doc.text(String(row.random_num ?? ""), x1 + 3, y, {
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

function addBagPages(
  doc: PDFKit.PDFDocument,
  bag: BagPayloadPdfData
) {
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
  bag: BagPayloadPdfData;
  outputPath?: string;
}): Promise<string> {
  const { bag } = options;
  const outputPath =
    options.outputPath ||
    path.join(os.tmpdir(), `payload_bag_${bag.bag_no}_${Date.now()}.pdf`);

  return writePdf(outputPath, (doc) => {
    addBagPages(doc, bag);
  });
}

async function generateBagPayloadAllPdf(options: {
  bags: BagPayloadPdfData[];
  outputPath?: string;
}): Promise<string> {
  const { bags } = options;
  const outputPath =
    options.outputPath ||
    path.join(os.tmpdir(), `payload_all_${Date.now()}.pdf`);

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
      bag: options.bag,
      outputPath: options.outputPath,
    });
    break;

  case "generateBagPayloadAllPdf":
    if (!options?.bags) {
      throw new Error("generateBagPayloadAllPdf ต้องมี options.bags");
    }
    filePath = await generateBagPayloadAllPdf({
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