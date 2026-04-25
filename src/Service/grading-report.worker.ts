import { parentPort, workerData } from "worker_threads";
import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import os from "os";
import { DB } from "../model/DB";
import {
  findQuestionCountForBagSubject,
  findBookletQuestionStatsForBag,
  getUnlockCampaignByBagId,
  getInfomation,
  getAllBags,
  getGraderInfo,
  findQuestionLabelForBagSubject,
  getUnlockCampaignNoconn,
  getCampaignUnlock,
  getGraderBagSummary,
  GraderBagSummaryRow,
} from "../Repo/grading-report.repo";
import passlistRepo from "../Repo/passlist.repo";
import rankingRepo from "../Repo/ranking-report.repo";

// =========================================================
// Interfaces & Helpers
// =========================================================
type SortKey = "score" | "examCode" | "name";
type SortOrder = "asc" | "desc";
type GroupItem = { sessionId: number; subjectId: number; questionNo: number };
type GroupRule = { title: string; items: GroupItem[] };
type SortBy = "TOTAL_DESC" | "TOTAL_ASC" | "EXAMCODE_ASC" | "EXAMCODE_DESC" | "NAME_ASC" | "NAME_DESC";

function keyOf(sessionId: number, subjectId: number, questionNo: number) {
  return `${sessionId}:${subjectId}:${questionNo}`;
}

function formatIntPdf(value: any): string {
  if (value == null || value === "") return "";
  const num = Number(value);
  if (!Number.isFinite(num)) return "";
  return String(Math.trunc(num));
}

function formatDecimalPdf(value: any): string {
  if (value == null || value === "") return "";
  const num = Number(value);
  if (!Number.isFinite(num)) return "";

  return Number.isInteger(num) ? String(num) : String(num);
}

// Logic จัดกลุ่มข้อมูลจาก DB ให้เป็นรูปแบบที่พร้อมพิมพ์
function buildBookletBlocks(raw: any[], questionCount: number, unlock: number) {
  const byBooklet = new Map<number, any>();
  for (const r of raw) {
    let block = byBooklet.get(r.booklet_id);
    if (!block) {
      block = {
        bookletId: r.booklet_id,
        examCode: unlock === 1 ? r.exam_code : String(r.random_num),
        questionCount: 0,
        questions: [],
      };
      byBooklet.set(r.booklet_id, block);
    }
    block.questions.push({
      questionNo: r.question_no, label: r.label ?? `ข้อ ${r.question_no}`,
      category: r.category ?? null, grader1Score: r.grader1_score != null ? Number(r.grader1_score) : null,
      grader1Name: r.grader1_names ?? null, grader2Score: r.grader2_score != null ? Number(r.grader2_score) : null,
      grader2Name: r.grader2_names ?? null, finalScore: r.final_score != null ? Number(r.final_score) : null,
    });
  }

  for (const block of byBooklet.values()) {
    const map = new Map<number, any>();
    for (const q of block.questions) map.set(q.questionNo, q);
    const maxQ = questionCount && questionCount > 0 ? questionCount : Array.from(map.keys()).reduce((m, q) => Math.max(m, q), 0);
    const filled: any[] = [];
    for (let q = 1; q <= maxQ; q++) {
      const s = map.get(q);
      filled.push(s ?? { questionNo: q, label: `ข้อ ${q}`, category: null, grader1Score: null, grader1Name: null, grader2Score: null, grader2Name: null, finalScore: null });
    }
    block.questionCount = maxQ;
    block.questions = filled;
  }
  return Array.from(byBooklet.values()).sort((a, b) => a.bookletId - b.bookletId);
}


function buildUnlockedBookletBlocks(raw: any[], questionCount: number) {
  const byBooklet = new Map<number, any>();
  for (const r of raw) {
    let block = byBooklet.get(r.booklet_id);
    if (!block) {
      block = {
        bookletId: r.booklet_id,
        randomNum: String(r.random_num ?? ""),
        examCode: r.exam_code ?? String(r.random_num),
        // ดึงชื่อมาด้วย (ต้องแน่ใจว่า SQL ใน Repo มีการ SELECT full_name หรือ title, first_name, last_name มาให้แล้ว)
        fullName:
          `${r.title ?? ""}${r.full_name ?? `${r.first_name ?? ""} ${r.last_name ?? ""}`}`
            .trim(),
        questionCount: 0,
        questions: [],
      };
      byBooklet.set(r.booklet_id, block);
    }
    block.questions.push({
      questionNo: r.question_no, label: r.label ?? `ข้อ ${r.question_no}`,
      category: r.category ?? null, grader1Score: r.grader1_score != null ? Number(r.grader1_score) : null,
      grader1Name: r.grader1_names ?? null, grader2Score: r.grader2_score != null ? Number(r.grader2_score) : null,
      grader2Name: r.grader2_names ?? null, finalScore: r.final_score != null ? Number(r.final_score) : null,
    });
  }

  for (const block of byBooklet.values()) {
    const map = new Map<number, any>();
    for (const q of block.questions) map.set(q.questionNo, q);
    const maxQ = questionCount && questionCount > 0 ? questionCount : Array.from(map.keys()).reduce((m, q) => Math.max(m, q), 0);
    const filled: any[] = [];
    for (let q = 1; q <= maxQ; q++) {
      const s = map.get(q);
      filled.push(s ?? { questionNo: q, label: `ข้อ ${q}`, category: null, grader1Score: null, grader1Name: null, grader2Score: null, grader2Name: null, finalScore: null });
    }
    block.questionCount = maxQ;
    block.questions = filled;
  }
  return Array.from(byBooklet.values()).sort((a, b) => a.examCode.localeCompare(b.examCode, undefined, { numeric: true }));
}

const FONT_NORMAL = path.resolve(__dirname, "../../fonts/THSarabunNew.ttf");
const FONT_BOLD = path.resolve(__dirname, "../../fonts/THSarabunNew-Bold.ttf");

// =========================================================
// Core Drawing Function: ใบปะหน้าถุง (ใช้ซ้ำใน BagScore และ CampaignBag)
// =========================================================
function drawBagScorePage(doc: any, info: any, booklets: any[], questionCount: number, questionLabels: any[], unlock: number) {
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const { left, right, top, bottom } = doc.page.margins;
  const contentWidth = pageWidth - left - right;
  const labelMap = new Map(questionLabels.map((q) => [q.question_no, q.label]));
  const title_code = unlock === 1 ? "รหัสประจำตัวสอบ" : "ลำดับจัดเก็บ";

  let y = top;
  doc.font(FONT_BOLD).fontSize(16).text(`เอกสารคะแนนการทดสอบเพื่อบรรจุเป็นข้าราชการอัยการในตำแหน่งอัยการผู้ช่วย พ.ศ.${info?.year_be} (${info?.campaign_size})`, left, y, { width: contentWidth, align: "center" });
  doc.font(FONT_NORMAL).fontSize(30).text(`ถุงที่ ${info?.bag_no}`, left, y, { width: contentWidth, align: "right" });

  y += 24;
  doc.font(FONT_NORMAL).fontSize(14).text(`วิชา${info?.subject_name}`, left, y, { width: contentWidth, align: "center" });
  y = doc.y + 10;

  const totalRows = 30;
  const colCodeWidth = 60, colPerScoreWidth = 22, colsPerQuestion = 4, colSumWidth = 40;
  const baseRowH1 = 42, baseRowH2 = 18, baseRowH = 16;
  const totalQuestionCols = questionCount * colsPerQuestion;
  const usedWidth = colCodeWidth + totalQuestionCols * colPerScoreWidth + colSumWidth;

  const widthScale = usedWidth > contentWidth ? contentWidth / usedWidth : 1;
  const availableTableHeight = pageHeight - bottom - y;
  const needH = (baseRowH1 + baseRowH2) + (totalRows * baseRowH);
  const heightScale = needH > availableTableHeight ? availableTableHeight / needH : 1;
  const scale = Math.min(widthScale, heightScale, 1);

  const cwCode = colCodeWidth * scale, cwScore = colPerScoreWidth * scale, cwSum = colSumWidth * scale;
  const rowH1 = baseRowH1 * scale, rowH2 = baseRowH2 * scale, rowH = baseRowH * scale;
  const fontHeaderSize = Math.max(7, 10 * scale), fontBodySize = Math.max(6, 9 * scale);
  const startX = left;

  // Draw Header
  let x = startX;
  doc.lineWidth(0.5).strokeColor("black");
  doc.font(FONT_BOLD).fontSize(fontHeaderSize);

  // รวบเส้น Header ชั้นบน
  let p = doc.rect(x, y, cwCode, rowH1 + rowH2);
  doc.text(title_code, x, y + 6 * scale, { width: cwCode, align: "center" });
  x += cwCode;
  for (let q = 1; q <= questionCount; q++) {
    const groupW = colsPerQuestion * cwScore;
    p = p.rect(x, y, groupW, rowH1);
    doc.text(`ข้อ ${q}\n${labelMap.get(q) ?? ""}`, x, y + 4 * scale, { width: groupW, align: "center", ellipsis: true });
    x += groupW;
  }
  // p = p.rect(x, y, cwSum, rowH1 + rowH2);
  // doc.text("รวม", x, y + 6 * scale, { width: cwSum, align: "center" });
  // x += cwSum;
  p = p.rect(x, y, cwSum, rowH1 + rowH2);
  doc.text("รวมทั้งหมด", x, y + 6 * scale, { width: cwSum, align: "center" });
  p.stroke();

  // แถวล่าง: หัวคอลัมน์ย่อย
  y += rowH1; x = startX + cwCode;
  const subHeads = ["ค.1", "ค.2", "ต่าง", "เฉลี่ย"];
  p = doc.lineWidth(0.5); // เริ่ม path ใหม่
  for (let q = 1; q <= questionCount; q++) {
    for (let h = 0; h < colsPerQuestion; h++) {
      p = p.rect(x, y, cwScore, rowH2);
      doc.text(subHeads[h], x, y + 3 * scale, { width: cwScore, align: "center" });
      x += cwScore;
    }
  }
  p.stroke();
  y += rowH2;

  // Draw Body
  doc.font(FONT_NORMAL).fontSize(fontBodySize);
  for (let i = 0; i < totalRows; i++) {
    const bk = booklets[i];
    x = startX;

    // ⚡ รวบเส้น Body แถวนี้ทั้งหมด
    let pathRow = doc.rect(x, y, cwCode, rowH);
    if (bk) doc.text(bk.examCode ?? "", x + 2 * scale, y + Math.max(1, (rowH - fontBodySize) / 2), { width: cwCode - 4 * scale, align: "left", ellipsis: true });
    x += cwCode;

    let totalPerSubject = 0;
    for (let q = 1; q <= questionCount; q++) {
      const qRow = bk?.questions?.find((qq: any) => qq.questionNo === q);
      const s1 = qRow?.grader1Score ?? null;
      const s2 = qRow?.grader2Score ?? null;
      const diff = s1 != null && s2 != null ? Math.abs(Number(s1) - Number(s2)) : null;
      const avg = s1 != null && s2 != null ? (Number(s1) + Number(s2)) / 2 : qRow?.finalScore ?? null;
      const vals = [
  formatIntPdf(s1),
  formatIntPdf(s2),
  formatIntPdf(diff),
  formatDecimalPdf(avg), // หรือ formatAveragePdf(avg)
];

      vals.forEach((val) => {
        pathRow = pathRow.rect(x, y, cwScore, rowH);
        doc.text(val, x, y + 3 * scale, { 
          width: cwScore, 
          align: "center", 
          ellipsis: true 
        });
        x += cwScore;
      });
      if (avg != null) totalPerSubject += Number(avg);
    }

    // pathRow = pathRow.rect(x, y, cwSum, rowH);
    // doc.text(bk ? totalPerSubject.toFixed(1) : "", x, y + 3 * scale, { width: cwSum, align: "center" });
    // x += cwSum;
    pathRow = pathRow.rect(x, y, cwSum, rowH);
    doc.text(bk ? totalPerSubject.toFixed(1) : "", x, y + 3 * scale, { width: cwSum, align: "center" });
    pathRow.stroke(); // วาดเส้นทีเดียว

    y += rowH;
  }
}
function drawUnlockedBagScorePage(
  doc: any,
  info: any,
  booklets: any[],
  questionCount: number,
  questionLabels: any[]
) {
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const { left, right, top, bottom } = doc.page.margins;
  const contentWidth = pageWidth - left - right;
  const labelMap = new Map(questionLabels.map((q) => [q.question_no, q.label]));

  let y = top;
  doc
    .font(FONT_BOLD)
    .fontSize(16)
    .text(
      `เอกสารคะแนนการทดสอบเพื่อบรรจุเป็นข้าราชการอัยการในตำแหน่งอัยการผู้ช่วย พ.ศ.${info?.year_be} (${info?.campaign_size})`,
      left,
      y,
      { width: contentWidth, align: "center" }
    );
  doc
    .font(FONT_NORMAL)
    .fontSize(30)
    .text(`ถุงที่ ${info?.bag_no}`, left, y, {
      width: contentWidth,
      align: "right",
    });

  y += 24;
  doc
    .font(FONT_NORMAL)
    .fontSize(14)
    .text(`วิชา${info?.subject_name}`, left, y, {
      width: contentWidth,
      align: "center",
    });
  y = doc.y + 10;

  const totalRows = 30;

  // ✅ เพิ่มคอลัมน์ชื่อ + ลำดับจัดเก็บ
  const colSeqWidth = 50;
  const colCodeWidth = 50;
  const colNameWidth = 100;
  const colPerScoreWidth = 22;
  const colsPerQuestion = 4;
  const colSumWidth = 40;

  const baseRowH1 = 42,
    baseRowH2 = 18,
    baseRowH = 16;

  const totalQuestionCols = questionCount * colsPerQuestion;
  const usedWidth =
    colSeqWidth +
    colCodeWidth +
    colNameWidth +
    totalQuestionCols * colPerScoreWidth +
    colSumWidth * 2;

  const widthScale = usedWidth > contentWidth ? contentWidth / usedWidth : 1;
  const availableTableHeight = pageHeight - bottom - y;
  const needH = baseRowH1 + baseRowH2 + totalRows * baseRowH;
  const heightScale =
    needH > availableTableHeight ? availableTableHeight / needH : 1;

  const scale = Math.min(widthScale, heightScale, 1);

  const cwSeq = colSeqWidth * scale;
  const cwCode = colCodeWidth * scale;
  const cwName = colNameWidth * scale;
  const cwScore = colPerScoreWidth * scale;
  const cwSum = colSumWidth * scale;

  const rowH1 = baseRowH1 * scale;
  const rowH2 = baseRowH2 * scale;
  const rowH = baseRowH * scale;

  const fontHeaderSize = Math.max(7, 10 * scale);
  const fontBodySize = Math.max(6, 9 * scale);

  const startX = left;

  doc.lineWidth(0.5).strokeColor("black");

  /* ---------------------------
     Draw Header (รวบเส้นเหมือนกัน)
  ----------------------------*/
  let x = startX;
  doc.font(FONT_BOLD).fontSize(fontHeaderSize);

  // รวบเส้น header ชั้นบน
  let p = doc.rect(x, y, cwSeq, rowH1 + rowH2);
  doc.text("ลำดับจัดเก็บ", x, y + 6 * scale, {
    width: cwSeq,
    align: "center",
  });
  x += cwSeq;

  p = p.rect(x, y, cwCode, rowH1 + rowH2);
  doc.text("รหัสประจำตัว\nสอบ", x, y + 4 * scale, {
    width: cwCode,
    align: "center",
    lineGap: 1 * scale,
  });
  x += cwCode;

  p = p.rect(x, y, cwName, rowH1 + rowH2);
  doc.text("ชื่อ-สกุล", x, y + 6 * scale, { width: cwName, align: "center" });
  x += cwName;

  for (let q = 1; q <= questionCount; q++) {
    const groupW = colsPerQuestion * cwScore;
    p = p.rect(x, y, groupW, rowH1);
    doc.text(`ข้อ ${q}\n${labelMap.get(q) ?? ""}`, x, y + 4 * scale, {
      width: groupW,
      align: "center",
      ellipsis: true,
    });
    x += groupW;
  }

  // p = p.rect(x, y, cwSum, rowH1 + rowH2);
  // doc.text("รวม", x, y + 6 * scale, { width: cwSum, align: "center" });
  // x += cwSum;

  p = p.rect(x, y, cwSum, rowH1 + rowH2);
  doc.text("รวมทั้งหมด", x, y + 6 * scale, { width: cwSum, align: "center" });

  p.stroke();

  // แถวล่าง: หัวคอลัมน์ย่อย
  y += rowH1;
  x = startX + cwSeq + cwCode + cwName;

  const subHeads = ["ค.1", "ค.2", "ต่าง", "เฉลี่ย"];
  p = doc.lineWidth(0.5); // เริ่ม path ใหม่

  for (let q = 1; q <= questionCount; q++) {
    for (let h = 0; h < colsPerQuestion; h++) {
      p = p.rect(x, y, cwScore, rowH2);
      doc.text(subHeads[h], x, y + 3 * scale, {
        width: cwScore,
        align: "center",
      });
      x += cwScore;
    }
  }
  p.stroke();

  y += rowH2;

  /* ---------------------------
     Draw Body (รวบเส้นต่อแถว เหมือน drawBagScorePage)
  ----------------------------*/
  doc.font(FONT_NORMAL).fontSize(fontBodySize);

  for (let i = 0; i < totalRows; i++) {
    const bk = booklets[i];
    x = startX;

    //  รวบเส้น body ต่อ 1 แถว
    let pathRow = doc.rect(x, y, cwSeq, rowH);
    if (bk) {
      doc.text(bk.randomNum ?? "", x + 2 * scale, y + Math.max(1, (rowH - fontBodySize) / 2), {
        width: cwSeq - 4 * scale,
        align: "center",
        ellipsis: true,
      });
    }
    x += cwSeq;

    pathRow = pathRow.rect(x, y, cwCode, rowH);
    if (bk) {
      doc.text(bk.examCode ?? "", x + 2 * scale, y + Math.max(1, (rowH - fontBodySize) / 2), {
        width: cwCode - 4 * scale,
        align: "center",
        ellipsis: true,
      });
    }
    x += cwCode;

    pathRow = pathRow.rect(x, y, cwName, rowH);
    if (bk) {
      doc.text(bk.fullName ?? "-", x + 2 * scale, y + Math.max(1, (rowH - fontBodySize) / 2), {
        width: cwName - 4 * scale,
        align: "left",
        ellipsis: true,
      });
    }
    x += cwName;

    let totalPerSubject = 0;

    for (let q = 1; q <= questionCount; q++) {
      const qRow = bk?.questions?.find((qq: any) => qq.questionNo === q);

      const s1 = qRow?.grader1Score ?? null;
      const s2 = qRow?.grader2Score ?? null;
      const diff =
        s1 != null && s2 != null ? Math.abs(Number(s1) - Number(s2)) : null;
      const avg =
        s1 != null && s2 != null
          ? (Number(s1) + Number(s2)) / 2
          : qRow?.finalScore ?? null;

     const vals = [
  formatIntPdf(s1),
  formatIntPdf(s2),
  formatIntPdf(diff),
  formatDecimalPdf(avg), // หรือ formatAveragePdf(avg)
];

      vals.forEach((val) => {
        pathRow = pathRow.rect(x, y, cwScore, rowH);
doc.text(val, x, y + 3 * scale, { 
          width: cwScore, 
          align: "center", 
          ellipsis: true 
        });
        x += cwScore;
      });

      if (avg != null) totalPerSubject += Number(avg);
    }

    // pathRow = pathRow.rect(x, y, cwSum, rowH);
    // doc.text(bk ? totalPerSubject.toFixed(1) : "", x, y + 3 * scale, {
    //   width: cwSum,
    //   align: "center",
    // });
    // x += cwSum;

    pathRow = pathRow.rect(x, y, cwSum, rowH);
    doc.text(bk ? totalPerSubject.toFixed(1) : "", x, y + 3 * scale, {
      width: cwSum,
      align: "center",
    });

    pathRow.stroke(); // ✅ ตีเส้นทีเดียวแบบ drawBagScorePage

    y += rowH;
  }
}
// =========================================================
// Task 1: Generate Bag Score PDF
// =========================================================
async function buildBagScorePdf(options: { bagId: number }, writeStream: fs.WriteStream) {
  const { bagId } = options;
  const conn = await DB.getInstance().getConnection();
  try {
    const info = await getInfomation(bagId);
    const questionCount = (await findQuestionCountForBagSubject(conn, bagId, 0)) ?? 0;
    const questionLabels = await findQuestionLabelForBagSubject(conn, bagId, 0);
    const rawPerBooklet = await findBookletQuestionStatsForBag(conn, bagId, 0);
    const result_is_unlock = await getUnlockCampaignNoconn(bagId);
    const unlock = result_is_unlock[0]?.is_unlock ?? 0;

    const booklets = buildBookletBlocks(rawPerBooklet, questionCount, unlock).sort((a, b) =>
      a.examCode.localeCompare(b.examCode, undefined, { numeric: true })
    );

    const doc = new PDFDocument({
      size: "A4", layout: "landscape", margins: { top: 40, bottom: 40, left: 40, right: 40 },
      autoFirstPage: true, bufferPages: false, // 🚀
    });
    doc.pipe(writeStream);

    drawBagScorePage(doc, info, booklets, questionCount, questionLabels ?? [], unlock);
    doc.end();
  } finally {
    conn.release();
  }
}

// =========================================================
// Task 2: Generate Campaign Bag Scores PDF (หลายๆ ถุง)
// =========================================================
async function buildCampaignBagScoresPdf(options: { campaignId: number }, writeStream: fs.WriteStream) {
  const conn = await DB.getInstance().getConnection();
  try {
    const bagRows = await getAllBags(conn, options.campaignId);
    const unlockData = await getCampaignUnlock(conn, options.campaignId);
    const unlock = unlockData ?? 0;

    if (!bagRows.length) throw new Error("ไม่พบถุงใด ๆ ในแคมเปญนี้");

    const doc = new PDFDocument({
      size: "A4", layout: "landscape", margins: { top: 40, bottom: 40, left: 40, right: 40 },
      autoFirstPage: false, bufferPages: false,
    });
    doc.pipe(writeStream);

    for (let i = 0; i < bagRows.length; i++) {
      const bagId = bagRows[i].bag_id;
      doc.addPage();

      const info = await getInfomation(bagId);
      const questionCount = (await findQuestionCountForBagSubject(conn, bagId, 0)) ?? 0;
      const questionLabels = await findQuestionLabelForBagSubject(conn, bagId, 0);
      const rawPerBooklet = await findBookletQuestionStatsForBag(conn, bagId, 0);
      const booklets = buildBookletBlocks(rawPerBooklet, questionCount, unlock).sort((a, b) =>
        a.examCode.localeCompare(b.examCode, undefined, { numeric: true })
      );

      drawBagScorePage(doc, info, booklets, questionCount, questionLabels ?? [], unlock);

      // พัก Event loop ถ้ามีหลายถุง
      if (i % 5 === 0) await new Promise(resolve => setTimeout(resolve, 0));
    }
    doc.end();
  } finally {
    conn.release();
  }
}

// =========================================================
// Task 3: Generate Grader Bag Summary
// =========================================================
async function buildGraderBagSummaryPdf(options: { bagId: number, graderId: number, graderName: string }, writeStream: fs.WriteStream) {
  const { bagId, graderId } = options;
  const conn = await DB.getInstance().getConnection();
  try {
    const info = await getInfomation(bagId);
    const graderInfo = await getGraderInfo(conn, bagId, graderId);
    const rows = await getGraderBagSummary(conn, bagId, graderId);

    const doc = new PDFDocument({
      size: "A4", layout: "portrait", margins: { top: 60, bottom: 50, left: 50, right: 50 },
      autoFirstPage: true, bufferPages: false,
    });
    doc.pipe(writeStream);

    const pageWidth = doc.page.width;
    const { left, right, bottom } = doc.page.margins;

    doc.font(FONT_NORMAL).fontSize(30).text(`ถุงที่ ${info?.bag_no ?? ""}`, left, 30, { width: pageWidth - left - right, align: "right" });
    doc.font(FONT_BOLD).fontSize(16).text("ใบบันทึกคะแนนผู้ตรวจ", { align: "center" }).moveDown(0.3);
    doc.font(FONT_NORMAL).fontSize(14).text(`วิชา ${info?.subject_name ?? ""}   ปี พ.ศ. ${info?.year_be ?? ""}`, { align: "center" }).moveDown(0.3);
    doc.text(`ข้อ ${graderInfo?.question_no}  ผู้ตรวจคนที่ ${graderInfo?.grader_order}`, { align: "center" }).moveDown(0.3);
    doc.text(`ชื่อ ${graderInfo?.full_name} `, { align: "center" }).moveDown(1);

    const startX = left;
    let y = doc.y + 5;
    const tableWidth = pageWidth - left - right;
    const colNoWidth = 40, colScoreWidth = 100;
    const colQrWidth = tableWidth - colNoWidth - colScoreWidth;
    const rowHeight = 20;

    const drawHeader = () => {
      doc.font(FONT_BOLD).fontSize(12).lineWidth(0.5).strokeColor("black");
      doc.rect(startX, y, colNoWidth, rowHeight)
        .rect(startX + colNoWidth, y, colQrWidth, rowHeight)
        .rect(startX + colNoWidth + colQrWidth, y, colScoreWidth, rowHeight).stroke();

      doc.text("ลำดับ", startX, y + 4, { width: colNoWidth, align: "center" });
      doc.text("รหัสข้อสอบ", startX + colNoWidth, y + 4, { width: colQrWidth, align: "center" }); // 👈 แก้ตรงนี้
      doc.text("คะแนน", startX + colNoWidth + colQrWidth, y + 4, { width: colScoreWidth, align: "center" });
      y += rowHeight;
      doc.font(FONT_NORMAL).fontSize(11);
    };
    drawHeader();

    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx];
      if (y + rowHeight > doc.page.height - bottom) {
        doc.addPage({ layout: "portrait" });
        doc.font(FONT_NORMAL).fontSize(30).text(`ถุงที่ ${info?.bag_no ?? ""} (ต่อ)`, left, 30, { width: pageWidth - left - right, align: "right" });
        y = doc.page.margins.top;
        drawHeader();
      }

      const xNo = startX, xQr = startX + colNoWidth, xScore = xQr + colQrWidth;
      // ⚡ รวบเส้น
      doc.rect(xNo, y, colNoWidth, rowHeight)
        .rect(xQr, y, colQrWidth, rowHeight)
        .rect(xScore, y, colScoreWidth, rowHeight).stroke();

      doc.text(String(idx + 1), xNo, y + 4, { width: colNoWidth, align: "center" });
      doc.text(row.exam_code ?? "-", xQr + 2, y + 4, { width: colQrWidth - 4, align: "left" }); // 👈 แก้ตรงนี้
      doc.text(row.total_score != null ? Number(row.total_score).toFixed(0) : "", xScore, y + 4, { width: colScoreWidth, align: "center" });

      y += rowHeight;
      if (idx % 200 === 0) await new Promise(resolve => setTimeout(resolve, 0));
    }

    doc.end();
  } finally {
    conn.release();
  }
}

async function buildUnlockedBagScorePdf(options: { bagId: number }, writeStream: fs.WriteStream) {
  const { bagId } = options;
  const conn = await DB.getInstance().getConnection();
  try {
    const info = await getInfomation(bagId);
    const questionCount = (await findQuestionCountForBagSubject(conn, bagId, 0)) ?? 0;
    const questionLabels = await findQuestionLabelForBagSubject(conn, bagId, 0);
    const rawPerBooklet = await findBookletQuestionStatsForBag(conn, bagId, 0);

    // ใช้ฟังก์ชันใหม่ที่เราเพิ่งสร้าง
    const booklets = buildUnlockedBookletBlocks(rawPerBooklet, questionCount);

    const doc = new PDFDocument({
      size: "A4", layout: "landscape", margins: { top: 40, bottom: 40, left: 40, right: 40 },
      autoFirstPage: true, bufferPages: false,
    });
    doc.pipe(writeStream);

    drawUnlockedBagScorePage(doc, info, booklets, questionCount, questionLabels ?? []);
    doc.end();
  } finally {
    conn.release();
  }
}

// =========================================================
// Task 4: Generate Pass List PDF
// =========================================================
async function buildPassListPdf(options: any, writeStream: fs.WriteStream) {
  const { campaignId, sort, order, includeScore } = options;
  const { examInfo, rows } = await passlistRepo.getPassListRows({ campaignId, sort, order });

  const doc = new PDFDocument({ size: "A4", margins: { top: 40, bottom: 40, left: 48, right: 48 }, autoFirstPage: true, bufferPages: false });
  doc.pipe(writeStream);

  doc.font(FONT_NORMAL).fontSize(14).text("บัญชีรายชื่อผู้สอบผ่านข้อเขียน", { align: "center" }).moveDown(0.2);
  doc.fontSize(12).text("(แนบท้ายประกาศ...)", { align: "center" }).moveDown(0.2);
  doc.text(`อัยการผู้ช่วย พ.ศ.${examInfo.year_be} (${examInfo.campaign_size})`, { align: "center" }).moveDown(0.2);
  doc.text(`ณ ${examInfo.site}`, { align: "center" }).moveDown(0.6);

  const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colW = includeScore ? [tableWidth * 0.10, tableWidth * 0.22, tableWidth * 0.48, tableWidth * 0.20] : [tableWidth * 0.12, tableWidth * 0.24, tableWidth * 0.64];
  const startX = doc.page.margins.left;
  let y = doc.y;
  const headerH = 20, rowH = 18;
  const x1 = startX, x2 = x1 + colW[0], x3 = x2 + colW[1], x4 = x3 + colW[2];

  const drawHeader = () => {
    doc.lineWidth(0.7).strokeColor("black");
    let p = doc.rect(startX, y, tableWidth, headerH).moveTo(x2, y).lineTo(x2, y + headerH).moveTo(x3, y).lineTo(x3, y + headerH);
    if (includeScore) p = p.moveTo(x4, y).lineTo(x4, y + headerH);
    p.stroke();

    const ty = y + 4;
    doc.font(FONT_BOLD).fontSize(12);
    doc.text("ลำดับที่", x1, ty, { width: colW[0], align: "center" });
    doc.text("เลขประจำตัวสอบ", x2, ty, { width: colW[1], align: "center" });
    doc.text("ชื่อ-สกุล", x3, ty, { width: colW[2], align: "center" });
    if (includeScore) doc.text("คะแนน", x4, ty, { width: colW[3], align: "center" });
    y += headerH; doc.font(FONT_NORMAL).fontSize(12);
  };

  drawHeader();

  for (let idx = 0; idx < rows.length; idx++) {
    const r = rows[idx];
    if (y + rowH > doc.page.height - doc.page.margins.bottom) {
      doc.addPage(); y = doc.page.margins.top; drawHeader();
    }
    let p = doc.rect(startX, y, tableWidth, rowH).moveTo(x2, y).lineTo(x2, y + rowH).moveTo(x3, y).lineTo(x3, y + rowH);
    if (includeScore) p = p.moveTo(x4, y).lineTo(x4, y + rowH);
    p.stroke();

    const ty = y + 3;
    doc.text(String(idx + 1), x1, ty, { width: colW[0], align: "center" });
    doc.text(r.userCode, x2, ty, { width: colW[1], align: "center" });
    doc.text(`${r.title ?? ""}${r.title ? " " : ""}${r.fullName}`, x3 + 6, ty, { width: colW[2] - 12, align: "left" });
    if (includeScore) doc.text(r.finalScore == null ? "-" : Number(r.finalScore).toFixed(2), x4, ty, { width: colW[3], align: "center" });

    y += rowH;
    if (idx % 200 === 0) await new Promise(resolve => setTimeout(resolve, 0));
  }
  doc.end();
}

// =========================================================
// Task 5: Generate Ranking PDF
// =========================================================
async function buildRankingPdf(options: any, writeStream: fs.WriteStream) {
  const examInfo = await rankingRepo.getExamInfo(options.campaignId);
  const rawData = await rankingRepo.getRankingRawRows({ campaignId: options.campaignId, subjectIds: options.subjectIds });
  console.log(`Raw data rows: ${rawData}`);

  const usersMap = new Map<string, any>();
  for (const row of rawData) {
    if (!usersMap.has(row.user_code)) {
      usersMap.set(row.user_code, { userCode: row.user_code, title: row.title, fullName: row.full_name, roomCode: row.room_code, totalScore: 0, groupScores: [], isCompleted: true, scoresMap: new Map() });
    }
    const user = usersMap.get(row.user_code)!;
    const key = keyOf(row.session_id, row.subject_id, row.question_no);
    user.scoresMap.set(key, row.avg_score);
    if (!row.has_both) user.isCompleted = false;
    if (row.avg_score != null) user.totalScore += Number(row.avg_score);
  }

  const groups: GroupRule[] = options.groups || [];
  for (const user of usersMap.values()) {
    user.groupScores = groups.map((group) => {
      let sum = 0;
      for (const item of group.items) {
        const sc = user.scoresMap.get(keyOf(item.sessionId, item.subjectId, item.questionNo));
        if (sc != null) sum += Number(sc);
      }
      return sum;
    });
  }

  let rankingList = Array.from(usersMap.values());
  rankingList = rankingList.filter(u => u.totalScore >= 0);   //เดิม 50 

console.log("usersMap size =", usersMap.size);
console.log("rankingList before filter =", Array.from(usersMap.values()).map(u => ({
  userCode: u.userCode,
  totalScore: u.totalScore,
  isCompleted: u.isCompleted
})));

rankingList = rankingList.filter(u => u.totalScore >= 0);   //เดิม 50

console.log("rankingList after >=50 filter =", rankingList.length);

  if (options.onlyCompleted) rankingList = rankingList.filter((u) => u.isCompleted);

  const sortBy = (options.sortBy || "TOTAL_DESC") as SortBy;
  rankingList.sort((a, b) => {
    if (sortBy === "EXAMCODE_ASC") return a.userCode.localeCompare(b.userCode);
    if (sortBy === "EXAMCODE_DESC") return b.userCode.localeCompare(a.userCode);
    if (sortBy === "NAME_ASC") return a.fullName.localeCompare(b.fullName, "th");
    if (sortBy === "NAME_DESC") return b.fullName.localeCompare(a.fullName, "th");

    const dir = sortBy === "TOTAL_ASC" ? 1 : -1;
    if (Math.abs(a.totalScore - b.totalScore) > 0.0001) return (a.totalScore - b.totalScore) * dir;
    for (let i = 0; i < groups.length; i++) {
      if (Math.abs(a.groupScores[i] - b.groupScores[i]) > 0.0001) return (a.groupScores[i] - b.groupScores[i]) * dir;
    }
    return a.userCode.localeCompare(b.userCode);
  });

  if (options.limit > 0) rankingList = rankingList.slice(0, options.limit);

  const doc = new PDFDocument({ size: "A4", margins: { top: 40, bottom: 40, left: 40, right: 40 }, autoFirstPage: true, bufferPages: false });
  doc.pipe(writeStream);

  const drawHeaderInfo = () => {
    let headerY = 40;

    doc.font(FONT_BOLD)
      .fontSize(16)
      .text("บัญชีรายชื่อเรียงลำดับคะแนน", 40, headerY, { align: "center" });

    headerY += 22;

    doc.font(FONT_NORMAL)
      .fontSize(12)
      .text(
        `สนามสอบ: ${examInfo.site} (${examInfo.campaign_size} ${examInfo.year_be})`,
        40,
        headerY,
        { align: "center" }
      );

    return headerY + 20; // คืนค่า y ถัดไป
  };
  drawHeaderInfo();

  const pageWidth = doc.page.width - 80;
  const colWidths = [pageWidth * 0.1, pageWidth * 0.2, pageWidth * 0.55, pageWidth * 0.15];
  const drawTableHeader = (currentY: number) => {
    doc.font(FONT_BOLD).fontSize(12).lineWidth(0.5)
      .rect(40, currentY, pageWidth, 20)
      .moveTo(40 + colWidths[0], currentY).lineTo(40 + colWidths[0], currentY + 20)
      .moveTo(40 + colWidths[0] + colWidths[1], currentY).lineTo(40 + colWidths[0] + colWidths[1], currentY + 20)
      .moveTo(40 + colWidths[0] + colWidths[1] + colWidths[2], currentY).lineTo(40 + colWidths[0] + colWidths[1] + colWidths[2], currentY + 20)
      .stroke();
    ["ลำดับ", "รหัสประจำตัว", "ชื่อ-สกุล", "คะแนนรวม"].forEach((h, i) => {
      doc.text(h, 40 + colWidths.slice(0, i).reduce((a, b) => a + b, 0), currentY + 5, { width: colWidths[i], align: "center" });
    });
  };

  let y = doc.y; drawTableHeader(y); y += 20; doc.font(FONT_NORMAL).fontSize(12);

  for (let idx = 0; idx < rankingList.length; idx++) {
    const row = rankingList[idx];
    if (y > doc.page.height - 50) {
      doc.addPage(); drawHeaderInfo(); y = doc.y; drawTableHeader(y); y += 20; doc.font(FONT_NORMAL);
    }

    doc.rect(40, y, pageWidth, 20)
      .moveTo(40 + colWidths[0], y).lineTo(40 + colWidths[0], y + 20)
      .moveTo(40 + colWidths[0] + colWidths[1], y).lineTo(40 + colWidths[0] + colWidths[1], y + 20)
      .moveTo(40 + colWidths[0] + colWidths[1] + colWidths[2], y).lineTo(40 + colWidths[0] + colWidths[1] + colWidths[2], y + 20).stroke();

    let x = 40;
    doc.text(String(idx + 1), x, y + 4, { width: colWidths[0], align: "center" }); x += colWidths[0];
    doc.text(row.userCode, x, y + 4, { width: colWidths[1], align: "center" }); x += colWidths[1];
    doc.text(`${row.title ? row.title : ''}${row.fullName}`, x + 5, y + 4, { width: colWidths[2] - 10, align: "left" }); x += colWidths[2];
    doc.text(row.totalScore.toFixed(2), x, y + 4, { width: colWidths[3], align: "center" });

    y += 20;
    if (idx % 200 === 0) await new Promise(resolve => setTimeout(resolve, 0));
  }
  // doc.end();
  const allKeys = new Set<string>();

  for (const u of rankingList) {
    for (const k of u.scoresMap.keys()) {
      allKeys.add(k);
    }
  }

  const scoreColumns = Array.from(allKeys).sort();

  // =============================
  // DRAW VERIFICATION PAGE
  // =============================
  function drawVerificationPage(
    doc: any,
    rankingList: any[],
    groups: { title: string }[]
  ) {
    const PAGE = {
      size: "A4",
      layout: "landscape",
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
    } as const;

    const groupHeaders = groups.map((g, i) => (g.title?.trim() ? g.title.trim() : `Group ${i + 1}`));
    const headers = ["ลำดับ", "รหัสประจำตัวสอบ", "ชื่อ-สกุล", ...groupHeaders, "รวม"];

    // fixed widths
    const wRank = 45;
    const wExam = 80;
    const wName = 220;

    const rowH = 16;
    const headH = 22;

    function addLandscapePageWithTitle() {
      doc.addPage(PAGE);

      // ✅ ตั้งฟอนต์/ขนาดทุกหน้าให้เหมือนกัน
      doc.font(FONT_BOLD).fontSize(14).text("ตารางตรวจสอบคะแนนตามกลุ่ม", {
        align: "center",
      });
    }

    function getBounds() {
      const left = doc.page.margins.left;
      const right = doc.page.margins.right;
      const top = doc.page.margins.top;
      const bottom = doc.page.margins.bottom;

      const pageWidth = doc.page.width - left - right;
      const pageHeight = doc.page.height - bottom; // bottom boundary (y ห้ามเกิน)

      return { left, right, top, bottom, pageWidth, pageHeight };
    }

    function getColWidths(pageWidth: number) {
      const remainingCols = headers.length - 3; // group + total
      const wRest = (pageWidth - (wRank + wExam + wName)) / remainingCols;
      return [wRank, wExam, wName, ...Array(remainingCols).fill(wRest)];
    }

    function drawTableHeader(y: number, left: number, colWidths: number[]) {
      doc.font(FONT_BOLD).fontSize(8);

      let x = left;
      for (let i = 0; i < headers.length; i++) {
        const w = colWidths[i];
        doc.rect(x, y, w, headH).stroke();
        doc.text(headers[i], x + 2, y + 6, { width: w - 4, align: "center" });
        x += w;
      }
      return y + headH;
    }

    // --- first page ---
    addLandscapePageWithTitle();

    // ✅ อย่าพึ่ง doc.y มากเกินไป → ล็อกจุดเริ่มตารางให้คงที่
    let { left, pageWidth, pageHeight, top } = getBounds();
    let colWidths = getColWidths(pageWidth);

    let y = top + 28; // ระยะจากขอบบนแบบคงที่ (ปรับได้)
    y = drawTableHeader(y, left, colWidths);

    doc.font(FONT_NORMAL).fontSize(8);

    for (let index = 0; index < rankingList.length; index++) {
      const user = rankingList[index];

      // ✅ ต้องใช้ pageHeight ของ "หน้าปัจจุบัน"
      ({ left, pageWidth, pageHeight, top } = getBounds());
      colWidths = getColWidths(pageWidth);

      if (y + rowH > pageHeight) {
        addLandscapePageWithTitle();

        ({ left, pageWidth, pageHeight, top } = getBounds());
        colWidths = getColWidths(pageWidth);

        y = top + 28;
        y = drawTableHeader(y, left, colWidths);
        doc.font(FONT_NORMAL).fontSize(8);
      }

      const rowData = [
        index + 1,
        user.userCode,
        `${user.title ?? ""}${user.fullName ?? ""}`,
        ...(user.groupScores ?? []).map((v: any) => (v == null ? "-" : Number(v).toFixed(2))),
        Number(user.totalScore ?? 0).toFixed(2),
      ];

      let x = left;
      for (let i = 0; i < rowData.length; i++) {
        const w = colWidths[i];
        doc.rect(x, y, w, rowH).stroke();

        const isName = i === 2;
        doc.text(String(rowData[i]), x + (isName ? 4 : 0), y + 4, {
          width: w - (isName ? 8 : 0),
          align: isName ? "left" : "center",
          ellipsis: true,
        });

        x += w;
      }

      y += rowH;
    }
  }
  // =============================
  // CALL IT
  // =============================
  drawVerificationPage(doc, rankingList, groups);
  doc.end();
}

async function buildUnlockedCampaignBagScoresPdf(
  options: { campaignId: number },
  writeStream: fs.WriteStream
) {
  const conn = await DB.getInstance().getConnection();
  try {
    const bagRows = await getAllBags(conn, options.campaignId);

    if (!bagRows.length) throw new Error("ไม่พบถุงใด ๆ ในแคมเปญนี้");

    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      autoFirstPage: false,
      bufferPages: false,
    });
    doc.pipe(writeStream);

    for (let i = 0; i < bagRows.length; i++) {
      const bagId = bagRows[i].bag_id;
      doc.addPage();

      const info = await getInfomation(bagId);
      const questionCount =
        (await findQuestionCountForBagSubject(conn, bagId, 0)) ?? 0;
      const questionLabels = await findQuestionLabelForBagSubject(conn, bagId, 0);
      const rawPerBooklet = await findBookletQuestionStatsForBag(conn, bagId, 0);

      const booklets = buildUnlockedBookletBlocks(rawPerBooklet, questionCount);

      drawUnlockedBagScorePage(
        doc,
        info,
        booklets,
        questionCount,
        questionLabels ?? []
      );

      if (i % 5 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
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
    const fileName = `grading_${task}_${Date.now()}_${Math.floor(Math.random() * 1000)}.pdf`;
    const filePath = path.join(os.tmpdir(), fileName);
    const writeStream = fs.createWriteStream(filePath);

    if (task === 'generateBagScorePdf') await buildBagScorePdf(options, writeStream);
    else if (task === 'generateCampaignBagScoresPdf') await buildCampaignBagScoresPdf(options, writeStream);
    else if (task === 'generateGraderBagSummaryPdf') await buildGraderBagSummaryPdf(options, writeStream);
    else if (task === 'generatePassListPdf') await buildPassListPdf(options, writeStream);
    else if (task === 'generateRankingPdf') await buildRankingPdf(options, writeStream);
    else if (task === 'generateUnlockedBagScorePdf') await buildUnlockedBagScorePdf(options, writeStream);
    else if (task === 'generateUnlockedCampaignBagScoresPdf') await buildUnlockedCampaignBagScoresPdf(options, writeStream);

    writeStream.on('finish', () => { parentPort?.postMessage({ status: 'success', filePath }); });
    writeStream.on('error', (err) => { throw err; });

  } catch (error) {
    parentPort?.postMessage({ status: 'error', message: String(error) });
  }
}

runTask();