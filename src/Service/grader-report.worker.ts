import { parentPort, workerData } from "worker_threads";
import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import os from "os";
import { DB } from "../model/DB";

import graderReportRepo, {
  BagGradersReport,
  BagBookletGraderBlock,
  BagBookletGraderCell
} from "../Repo/grader-report.repo";
import { getUnlockCampaignByBagId } from "../Repo/grading-report.repo";

// --- Helper Functions ---
function safeText(s: any): string {
  return typeof s === "string" ? s : s == null ? "" : String(s);
}

// ฟังก์ชันสำหรับเตรียมข้อมูล (ยกมาจากตัว Service เดิม)
async function fetchBagGradersReport(
  bagId: number,
  subjectId: number,
  conn: any
): Promise<BagGradersReport> {
  const infoRow = await graderReportRepo.getBagInfo(conn, bagId, subjectId);
  const questionCountD = await graderReportRepo.getQuestionCountForBagSubject(conn, bagId, subjectId);
  const questionLabels = await graderReportRepo.getQuestionLabels(conn, subjectId);
  const raw = await graderReportRepo.getBookletGraderRows(conn, { bagId, subjectId });
  const result_is_unlock = await getUnlockCampaignByBagId(conn, bagId);

  const unlock = result_is_unlock[0]?.is_unlock ?? 0;
  const questionCount = questionCountD ?? 0;

  const byBooklet = new Map<number, BagBookletGraderBlock>();

  for (const r of raw) {
    const bookletId = Number(r.booklet_id);
    const user_code = unlock ? r.exam_code : r.random_num;
    const examCode = safeText(user_code);
    const qNo = Number(r.question_no);

    if (!byBooklet.has(bookletId)) {
      const questions: BagBookletGraderCell[] = [];
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

    const bk = byBooklet.get(bookletId)!;

    if (qNo > 0 && qNo <= questionCount) {
      const cell = bk.questions[qNo - 1];
      cell.grader1Name = r.grader1_name ? safeText(r.grader1_name) : null;
      cell.grader2Name = r.grader2_name ? safeText(r.grader2_name) : null;
      cell.grader1HasScore = r.grader1_score != null;
      cell.grader2HasScore = r.grader2_score != null;
    }
  }

  const booklets = Array.from(byBooklet.values()).sort((a, b) =>
    a.examCode.localeCompare(b.examCode, undefined, { numeric: true })
  );

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
}

const FONT_NORMAL = path.resolve(__dirname, "../../fonts/THSarabunNew.ttf");
const FONT_BOLD = path.resolve(__dirname, "../../fonts/THSarabunNew-Bold.ttf");

// ฟังก์ชันสำหรับวาดหน้ากระดาษ PDF สำหรับรายงานผู้ตรวจ
function drawBagGraderMatrixPage(doc: any, report: BagGradersReport) {
  const { info, booklets, questionCount, questionLabels, unlock } = report;

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const { left, right, top, bottom } = doc.page.margins;
  const contentWidth = pageWidth - left - right;

  const labelMap = new Map<number, string>(questionLabels.map((q: any) => [q.question_no, q.label]));
  const user_code_title = unlock === 1 ? "รหัสประจำตัวสอบ" : "เลขรหัส";

  // ====================== HEADER =======================
  let y = top;
  const headerY = y;

  doc.font(FONT_BOLD).fontSize(16).text("เอกสารรายชื่อผู้ตรวจรายข้อ", left, headerY, { width: contentWidth, align: "center" });
  doc.font(FONT_NORMAL).fontSize(30).text(`ถุงที่ ${info.bag_no}`, left, headerY, { width: contentWidth, align: "right" });

  y = headerY + 24;
  doc.font(FONT_NORMAL).fontSize(12).text(`${info.campaign_name ?? "-"}  พ.ศ.${info.year_be} (${info.campaign_size})`, left, y, { width: contentWidth, align: "center" });
  
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
    const label = labelMap.get(q) ?? "";
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
      doc.text(bk.examCode ?? "", x + 2 * scale, textY, { width: cwCode - 4 * scale, align: "left", ellipsis: true });
    }
    x += cwCode;

    for (let q = 1; q <= questionCount; q++) {
      const cell = bk?.questions?.[q - 1];
      const g1 = cell?.grader1Name?.split(" ")[0] ?? "";
      const g2 = cell?.grader2Name?.split(" ")[0] ?? "";

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
async function buildBagGraderPdf(options: any, writeStream: fs.WriteStream) {
  const { bagId } = options;
  const conn = await DB.getInstance().getConnection();
  try {
    const subjectId = await graderReportRepo.getDerivedSubjectIdForBag(conn, bagId);
    const report = await fetchBagGradersReport(bagId, subjectId, conn);

    const doc = new PDFDocument({
      size: "A4", layout: "landscape", margins: { top: 40, bottom: 40, left: 40, right: 40 },
      autoFirstPage: true, bufferPages: false, // 🚀
    });
    doc.pipe(writeStream);

    drawBagGraderMatrixPage(doc, report);
    doc.end();
  } finally {
    conn.release();
  }
}

// ---------------------------------------------------------
// Task 2: สร้าง PDF สำหรับ "ทุกถุงใน Campaign" (All Bags)
// ---------------------------------------------------------
async function buildCampaignAllBagsGradersPdf(options: any, writeStream: fs.WriteStream) {
  const { campaignId } = options;
  const conn = await DB.getInstance().getConnection();

  try {
    const bags = await graderReportRepo.getAllBags(conn, campaignId);
    if (!bags.length) throw new Error("ไม่พบถุงในแคมเปญนี้");

    const doc = new PDFDocument({
      size: "A4", layout: "landscape", margins: { top: 40, bottom: 40, left: 40, right: 40 },
      autoFirstPage: false, bufferPages: false, // 🚀
    });
    doc.pipe(writeStream);

    for (let i = 0; i < bags.length; i++) {
      const b = bags[i];
      doc.addPage({ size: "A4", layout: "landscape", margins: { top: 40, bottom: 40, left: 40, right: 40 }});
      
      const subjectId = await graderReportRepo.getDerivedSubjectIdForBag(conn, b.bag_id);
      const report = await fetchBagGradersReport(b.bag_id, subjectId, conn);

      drawBagGraderMatrixPage(doc, report);

      if (i % 5 === 0) await new Promise(resolve => setTimeout(resolve, 0));
    }
    doc.end();
  } finally {
    conn.release();
  }
}

// =========================================================
// Main Dispatcher
// =========================================================
async function runTask() {
  try {
    const { task, options } = workerData;
    const fileName = `grader_report_${task}_${Date.now()}_${Math.floor(Math.random() * 1000)}.pdf`;
    const filePath = path.join(os.tmpdir(), fileName);
    const writeStream = fs.createWriteStream(filePath);

    if (task === 'generateBagGraderPdf') await buildBagGraderPdf(options, writeStream);
    else if (task === 'generateCampaignAllBagsGradersPdf') await buildCampaignAllBagsGradersPdf(options, writeStream);

    writeStream.on('finish', () => { parentPort?.postMessage({ status: 'success', filePath }); });
    writeStream.on('error', (err) => { throw err; });

  } catch (error) {
    parentPort?.postMessage({ status: 'error', message: String(error) });
  }
}

runTask();