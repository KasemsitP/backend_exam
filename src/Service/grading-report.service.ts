import { DB } from "../model/DB";
import {
  findQuestionCountForBagSubject,
  findQuestionAveragesForBagSubject,
  RawQuestionAverageRow,
  RawQuestionStatsRow,
  RawBookletQuestionStatsRow,
  findBookletQuestionStatsForBag,
  getUnlockCampaignByBagId,
  getInfomation,
  getAllBags,
  getGraderInfo
} from "../Repo/grading-report.repo";

import passlistRepo, { PassListRow } from "../Repo/passlist.repo";

import {
  getGraderBagSummary,
  type GraderBagSummaryRow,
} from "../Repo/grading-report.repo";

import PDFDocument from "pdfkit";

import path from "path";
export interface BagQuestionScoreRow {
  questionNo: number;
  label: string;
  category: string | null;
  grader1Score: number | null;
  grader1Name: string | null;
  grader2Score: number | null;
  grader2Name: string | null;
  finalScore: number | null;
}


export interface BagBookletQuestionBlock {
  bookletId: number;
  examCode: string;
  questionCount: number;
  questions: BagQuestionScoreRow[];

}

type SortKey = "score" | "examCode" | "name";
type SortOrder = "asc" | "desc";


function buildBookletBlocks(
  raw: RawBookletQuestionStatsRow[],
  questionCount: number,
  unlock: number
): BagBookletQuestionBlock[] {
  const byBooklet = new Map<number, BagBookletQuestionBlock>();

  // 1) group ตาม booklet_id
  for (const r of raw) {
    let block = byBooklet.get(r.booklet_id);
    if (!block) {
      block = {
        bookletId: r.booklet_id,
        examCode: unlock === 1
          ? r.exam_code
          : String(r.booklet_id),
        questionCount: 0,
        questions: [],
      };
      byBooklet.set(r.booklet_id, block);
    }

    block.questions.push({
      questionNo: r.question_no,
      label: r.label ?? `ข้อ ${r.question_no}`,
      category: r.category ?? null,
      grader1Score: r.grader1_score != null ? Number(r.grader1_score) : null,
      grader1Name: r.grader1_names ?? null,
      grader2Score: r.grader2_score != null ? Number(r.grader2_score) : null,
      grader2Name: r.grader2_names ?? null,
      finalScore: r.final_score != null ? Number(r.final_score) : null,
    });
  }

  // 2) padding ให้ครบ 1..questionCount ทุกเล่ม
  for (const block of byBooklet.values()) {
    const map = new Map<number, BagQuestionScoreRow>();
    for (const q of block.questions) {
      map.set(q.questionNo, q);
    }

    const maxQ =
      questionCount && questionCount > 0
        ? questionCount
        : Array.from(map.keys()).reduce((m, q) => Math.max(m, q), 0);

    const filled: BagQuestionScoreRow[] = [];
    for (let q = 1; q <= maxQ; q++) {
      const s = map.get(q);
      filled.push(
        s ?? {
          questionNo: q,
          label: `ข้อ ${q}`,
          category: null,
          grader1Score: null,
          grader1Name: null,
          grader2Score: null,
          grader2Name: null,
          finalScore: null,
        }
      );
    }

    block.questionCount = maxQ;
    block.questions = filled;
  }

  // 3) sort ตาม bookletId เพื่อให้เรียงสวย ๆ
  return Array.from(byBooklet.values()).sort(
    (a, b) => a.bookletId - b.bookletId
  );
}

export function buildQuestionRows(
  stats: RawQuestionStatsRow[],
  questionCount: number
): BagQuestionScoreRow[] {
  const byQ = new Map<number, RawQuestionStatsRow>();
  for (const s of stats) {
    byQ.set(s.question_no, s);
  }

  // ถ้า questionCount = 0 ให้ใช้ max จาก stats
  const maxQ =
    questionCount && questionCount > 0
      ? questionCount
      : stats.reduce((mx, s) => Math.max(mx, s.question_no), 0);

  const rows: BagQuestionScoreRow[] = [];
  for (let q = 1; q <= maxQ; q++) {
    const s = byQ.get(q);
    rows.push({
      questionNo: q,
      label: s?.label ?? `ข้อ ${q}`,
      category: s?.category ?? null,
      grader1Score: s?.grader1_score ?? null,
      grader1Name: s?.grader1_names ?? null,
      grader2Score: s?.grader2_score ?? null,
      grader2Name: s?.grader2_names ?? null,
      finalScore: s?.final_score ?? null,
    });
  }
  return rows;
}

export interface BagScoresResponse {
  bagId: number;
  subjectId: number;
  questionCount: number;
  booklets: BagBookletQuestionBlock[];
}
export interface BagSubjectScoreRow {
  bookletId: number;
  examCode: string;
  perQuestion: Record<number, number | null>;
  totalScore: number;
}

export interface BagSubjectScoreResult {
  bagId: number;
  subjectId: number;
  questionCount: number;
  rows: BagSubjectScoreRow[];
}

export class GradingReportService {
  /**
   * ดึงคะแนนรายถุง รายวิชา แบบ dynamic ตามจำนวนข้อ
   * - 1 ข้อตรวจ 2 คน → เฉลี่ยด้วย AVG แล้ว
   */

  private static drawBagScorePage(
    doc: any,
    info: any,
    booklets: BagBookletQuestionBlock[],
    questionCount: number
  ) {
    const fontNormal = path.join(__dirname, "../fonts/THSarabunNew.ttf");
    const fontBold = path.join(__dirname, "../fonts/THSarabunNew-Bold.ttf");

    const pageWidth = doc.page.width;
    const { left, right, bottom } = doc.page.margins;
    const tableWidth = pageWidth - left - right;

    // ========== ถุงมุมขวาบน ==========
    doc
      .font(fontNormal)
      .fontSize(30)
      .text(`ถุงที่ ${info?.bag_no}`, left, 20, {
        width: pageWidth - left - right,
        align: "right",
      });

    // ========== Header กลาง ==========
    doc.font(fontBold).fontSize(16).text(
      `เอกสารคะแนนการทดสอบเพื่อบรรจุเป็นข้าราชการอัยการในตำแหน่งอัยการผู้ช่วย พ.ศ.${info?.year_be} (${info?.campaign_size})`,
      { align: "center" }
    );

    doc.moveDown(0.2);
    doc.font(fontNormal).fontSize(14).text(`วิชา${info?.subject_name}`, {
      align: "center",
    });
    doc.moveDown(1);

    // ========== ตารางแนวนอน ==========
    // คอลัมน์: รหัส + 4*question + รวม + รวมทั้งหมด
    const colCodeWidth = 60;
    const colPerScoreWidth = 22; // ค.1 / ค.2 / ต่าง / เฉลี่ย
    const colsPerQuestion = 4;
    const colSumWidth = 40;
    const totalQuestionCols = questionCount * colsPerQuestion;

    const usedWidth =
      colCodeWidth + totalQuestionCols * colPerScoreWidth + colSumWidth * 2;

    const scale = usedWidth > tableWidth ? tableWidth / usedWidth : 1;

    const cwCode = colCodeWidth * scale;
    const cwScore = colPerScoreWidth * scale;
    const cwSum = colSumWidth * scale;

    const startX = left;
    const startY = doc.y;
    let y = startY;
    const rowH1 = 20;
    const rowH2 = 18;

    const drawHeader = () => {
      let x = startX;

      doc.lineWidth(0.5).strokeColor("black");
      doc.font(fontBold).fontSize(10);

      // แถวบน
      doc.rect(startX, y, cwCode, rowH1 + rowH2).stroke();
      doc.text("รหัส", x, y + 6, { width: cwCode, align: "center" });
      x += cwCode;

      for (let q = 1; q <= questionCount; q++) {
        const groupWidth = colsPerQuestion * cwScore;
        doc.rect(x, y, groupWidth, rowH1).stroke();
        doc.text(`ข้อ ${q}`, x, y + 4, { width: groupWidth, align: "center" });
        x += groupWidth;
      }

      // รวมรายวิชา + รวมทั้งหมด
      doc.rect(x, y, cwSum, rowH1 + rowH2).stroke();
      doc.text("รวม", x, y + 6, { width: cwSum, align: "center" });
      x += cwSum;

      doc.rect(x, y, cwSum, rowH1 + rowH2).stroke();
      doc.text("รวมทั้งหมด", x, y + 6, { width: cwSum, align: "center" });

      // แถวล่าง (หัวคอลัมน์ย่อย)
      y += rowH1;
      x = startX + cwCode;

      const subHeads = ["ค.1", "ค.2", "ต่าง", "เฉลี่ย"];
      for (let q = 1; q <= questionCount; q++) {
        for (let h = 0; h < colsPerQuestion; h++) {
          doc.rect(x, y, cwScore, rowH2).stroke();
          doc.text(subHeads[h], x, y + 3, {
            width: cwScore,
            align: "center",
          });
          x += cwScore;
        }
      }

      // ล่างสุดของ header
      doc.rect(startX, y, cwCode, rowH2).stroke(); // เส้นใต้ "รหัส"

      doc
        .rect(startX + cwCode + totalQuestionCols * cwScore, y, cwSum, rowH2)
        .stroke();
      doc
        .rect(
          startX + cwCode + totalQuestionCols * cwScore + cwSum,
          y,
          cwSum,
          rowH2
        )
        .stroke();

      y += rowH2;
    };

    // วาด header
    drawHeader();

    const rowHeight = 16;
    doc.font(fontNormal).fontSize(9);

    const ensurePage = () => {
      if (y + rowHeight > doc.page.height - bottom) {
        doc.addPage({ layout: "landscape" });
        y = doc.page.margins.top;
        // header ใหม่บนหน้าใหม่
        drawHeader();
      }
    };

    // เนื้อหาแต่ละเล่ม
    for (const bk of booklets) {
      ensurePage();

      let x = startX;

      // รหัสสอบ
      doc.rect(x, y, cwCode, rowHeight).stroke();
      doc.text(bk.examCode, x + 2, y + 3, {
        width: cwCode - 4,
        align: "left",
      });
      x += cwCode;

      // รายข้อ
      let totalPerSubject = 0;

      for (let q = 1; q <= questionCount; q++) {
        const qRow = bk.questions.find((qq) => qq.questionNo === q);
        const s1 = qRow?.grader1Score ?? null;
        const s2 = qRow?.grader2Score ?? null;
        const diff =
          s1 != null && s2 != null ? Math.abs(Number(s1) - Number(s2)) : null;
        const avg =
          s1 != null && s2 != null
            ? (Number(s1) + Number(s2)) / 2
            : qRow?.finalScore ?? null;

        const vals = [s1, s2, diff, avg];

        vals.forEach((val) => {
          doc.rect(x, y, cwScore, rowHeight).stroke();
          doc.text(
            val == null ? "" : Number(val).toFixed(1),
            x + 1,
            y + 3,
            { width: cwScore - 2, align: "right" }
          );
          x += cwScore;
        });

        if (avg != null) {
          totalPerSubject += Number(avg);
        }
      }

      // รวมรายวิชา
      doc.rect(x, y, cwSum, rowHeight).stroke();
      doc.text(totalPerSubject.toFixed(1), x, y + 3, {
        width: cwSum,
        align: "right",
      });
      x += cwSum;

      // รวมทั้งหมด (ตอนนี้ใช้ค่าเดียวกันไปก่อน)
      doc.rect(x, y, cwSum, rowHeight).stroke();
      doc.text(totalPerSubject.toFixed(1), x, y + 3, {
        width: cwSum,
        align: "right",
      });

      y += rowHeight;
    }
  }

  static async getScoresForBagSubject(
    bagId: number,
  ): Promise<BagSubjectScoreResult> {
    const conn = await DB.getInstance().getConnection();

    const subjectId = 0
    try {
      // 1) หา question_count ก่อน
      const questionCount =
        (await findQuestionCountForBagSubject(conn, bagId, subjectId)) ?? 0;

      // 2) ดึงข้อมูล row ดิบ (booklet_id, exam_code, question_no, avg_score)
      const rawRows: RawQuestionAverageRow[] =
        await findQuestionAveragesForBagSubject(conn, bagId, subjectId);

      // 3) รวมเป็น per-booklet แบบ dynamic
      const byBooklet = new Map<number, BagSubjectScoreRow>();

      for (const row of rawRows) {
        const bookletId = row.booklet_id;
        const questionNo = Number(row.question_no);
        const avgScore = Number(row.avg_score ?? 0);

        if (!byBooklet.has(bookletId)) {
          // เตรียม object เปล่าพร้อม perQuestion ทุกข้อเป็น null ก่อนก็ได้
          const perQuestion: Record<number, number | null> = {};
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

        const agg = byBooklet.get(bookletId)!;

        // ใส่คะแนนเฉลี่ยในข้อที่ตรงกัน
        agg.perQuestion[questionNo] = avgScore;
      }

      // 4) คำนวณ totalScore ให้แต่ละเล่ม
      const rows: BagSubjectScoreRow[] = Array.from(byBooklet.values()).map(
        (r) => {
          let sum = 0;
          for (let q = 1; q <= questionCount; q++) {
            const sc = r.perQuestion[q];
            if (sc != null) {
              sum += Number(sc);
            }
          }
          return {
            ...r,
            totalScore: sum,
          };
        }
      );

      return {
        bagId,
        subjectId,
        questionCount,
        rows,
      };
    } finally {
      conn.release();
    }
  }
  static async getBagScoresReport(
    bagId: number,
    subjectId: number = 0
  ): Promise<BagScoresResponse> {
    const conn = await DB.getInstance().getConnection();
    try {
      // 1) จำนวนข้อจาก session_subjects (เหมือนเดิม)
      const questionCount =
        (await findQuestionCountForBagSubject(conn, bagId, subjectId)) ?? 0;

      // 2) raw รายเล่ม-รายข้อ
      const rawPerBooklet = await findBookletQuestionStatsForBag(
        conn,
        bagId,
        subjectId
      );
      const result_is_unlock = await getUnlockCampaignByBagId(conn, bagId)
      //  console.log(result_is_unlock)


      console.log(result_is_unlock[0].campaign_id)

      const unlock = result_is_unlock[0].is_unlock

      const booklets = buildBookletBlocks(rawPerBooklet, questionCount, unlock);

      return {
        bagId,
        subjectId,
        questionCount,
        booklets,
      };
    } finally {
      conn.release();
    }
  }
  static async generateBagScorePdf(bagId: number): Promise<Buffer> {

    const info = await getInfomation(bagId)
    console.log(info)
    // ดึงข้อมูลคะแนนตามถุง
    const report = await GradingReportService.getBagScoresReport(bagId, 0);
    const { booklets, questionCount } = report;

    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",   // 👈 ตรงนี้ทำให้เป็นแนวนอน
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
    });

    const fontNormal = path.join(__dirname, "../fonts/THSarabunNew.ttf");
    const fontBold = path.join(__dirname, "../fonts/THSarabunNew-Bold.ttf");

    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    const pdfPromise = new Promise<Buffer>((resolve, reject) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });

    /* ========== ตารางแนวนอน ========== */
    const pageWidth = doc.page.width;
    const { left, right, bottom } = doc.page.margins;
    const tableWidth = pageWidth - left - right;
    doc
      .font(fontNormal)
      .fontSize(30)
      .text(
        `ถุงที่ ${info?.bag_no}`,
        left,
        20,
        {
          width: pageWidth - left - right,
          align: "right",
        }
      );

    /* ========== Header ========== */
    doc.font(fontBold).fontSize(16).text(
      `เอกสารคะแนนการทดสอบเพื่อบรรจุเป็นข้าราชการอัยการในตำแหน่งอัยการผู้ช่วย พ.ศ.${info?.year_be} (${info?.campaign_size})`,
      { align: "center" }
    );

    doc.moveDown(0.2);
    doc.font(fontNormal).fontSize(14).text(
      `วิชา${info?.subject_name}`,
      { align: "center" }
    );
    doc.moveDown(1);



    // คอลัมน์: รหัส + 4*question + รวม + รวมทั้งหมด (ตัวอย่าง)
    const colCodeWidth = 60;
    const colPerScoreWidth = 22; // ค.ค.1 / ค.ค.2 / ต่าง / เฉลี่ย
    const colsPerQuestion = 4;
    const colSumWidth = 40;
    const totalQuestionCols = questionCount * colsPerQuestion;

    const usedWidth =
      colCodeWidth +
      totalQuestionCols * colPerScoreWidth +
      colSumWidth * 2;

    const scale = usedWidth > tableWidth ? tableWidth / usedWidth : 1;

    const cwCode = colCodeWidth * scale;
    const cwScore = colPerScoreWidth * scale;
    const cwSum = colSumWidth * scale;

    const startX = left;
    const startY = doc.y;
    let y = startY;
    const rowH1 = 20;
    const rowH2 = 18;

    // ฟังก์ชันวาด header 2 ชั้น (แบบง่าย ๆ)
    const drawHeader = () => {
      let x = startX;

      doc.lineWidth(0.5).strokeColor("black");
      doc.font(fontBold).fontSize(10);

      // แถวบน
      doc.rect(startX, y, cwCode, rowH1 + rowH2).stroke();
      doc.text("รหัส", x, y + 6, { width: cwCode, align: "center" });
      x += cwCode;

      for (let q = 1; q <= questionCount; q++) {
        const groupWidth = colsPerQuestion * cwScore;
        doc.rect(x, y, groupWidth, rowH1).stroke();
        doc.text(`ข้อ ${q}`, x, y + 4, { width: groupWidth, align: "center" });
        x += groupWidth;
      }

      // รวมรายวิชา + รวมทั้งหมด
      doc.rect(x, y, cwSum, rowH1 + rowH2).stroke();
      doc.text("รวม", x, y + 6, { width: cwSum, align: "center" });
      x += cwSum;

      doc.rect(x, y, cwSum, rowH1 + rowH2).stroke();
      doc.text("รวมทั้งหมด", x, y + 6, { width: cwSum, align: "center" });

      // แถวล่าง (หัวคอลัมน์ย่อย)
      y += rowH1;
      x = startX + cwCode;

      const subHeads = ["ค.1", "ค.2", "ต่าง", "เฉลี่ย"];
      for (let q = 1; q <= questionCount; q++) {
        for (let h = 0; h < colsPerQuestion; h++) {
          doc.rect(x, y, cwScore, rowH2).stroke();
          doc.text(subHeads[h], x, y + 3, {
            width: cwScore,
            align: "center",
          });
          x += cwScore;
        }
      }

      // ล่างสุดของ header
      doc.rect(startX, y, cwCode, rowH2).stroke(); // เส้นใต้ "รหัส"
      // ช่อง sum ทั้งสอง
      doc.rect(
        startX + cwCode + totalQuestionCols * cwScore,
        y,
        cwSum,
        rowH2
      ).stroke();
      doc.rect(
        startX + cwCode + totalQuestionCols * cwScore + cwSum,
        y,
        cwSum,
        rowH2
      ).stroke();

      y += rowH2;
    };

    drawHeader();

    const rowHeight = 16;
    doc.font(fontNormal).fontSize(9);

    const ensurePage = () => {
      if (y + rowHeight > doc.page.height - bottom) {
        doc.addPage({ layout: "landscape" });
        y = doc.page.margins.top;
        drawHeader();
      }
    };

    for (const bk of booklets) {
      ensurePage();

      let x = startX;
      // รหัส
      doc.rect(x, y, cwCode, rowHeight).stroke();
      doc.text(bk.examCode, x + 2, y + 3, {
        width: cwCode - 4,
        align: "left",
      });
      x += cwCode;

      // รายข้อ
      let totalPerSubject = 0;
      for (let q = 1; q <= questionCount; q++) {
        const qRow = bk.questions.find((qq) => qq.questionNo === q);
        const s1 = qRow?.grader1Score ?? null;
        const s2 = qRow?.grader2Score ?? null;
        const diff =
          s1 != null && s2 != null ? Math.abs(Number(s1) - Number(s2)) : null;
        const avg =
          s1 != null && s2 != null
            ? (Number(s1) + Number(s2)) / 2
            : qRow?.finalScore ?? null;

        const vals = [s1, s2, diff, avg];

        vals.forEach((val) => {
          doc.rect(x, y, cwScore, rowHeight).stroke();
          doc.text(
            val == null ? "" : Number(val).toFixed(1),
            x + 1,
            y + 3,
            { width: cwScore - 2, align: "right" }
          );
          x += cwScore;
        });

        if (avg != null) totalPerSubject += Number(avg);
      }

      // รวมรายวิชา
      doc.rect(x, y, cwSum, rowHeight).stroke();
      doc.text(totalPerSubject.toFixed(1), x, y + 3, {
        width: cwSum,
        align: "right",
      });
      x += cwSum;

      // รวมทั้งหมด (ถ้าคุณมีอีกวิชา ค่อยเติม logic)
      doc.rect(x, y, cwSum, rowHeight).stroke();
      doc.text(totalPerSubject.toFixed(1), x, y + 3, {
        width: cwSum,
        align: "right",
      });

      y += rowHeight;
    }

    doc.end();
    return pdfPromise;
  }
  static async generateCampaignBagScoresPdf(
    campaignId: number
  ): Promise<Buffer> {
    const conn = await DB.getInstance().getConnection();

    try {
      // ดึงถุงทั้งหมดใน campaign นี้
      const bagRows = await getAllBags(campaignId);
      console.log(campaignId, bagRows);

      if (!bagRows.length) {
        throw new Error("ไม่พบถุงใด ๆ ในแคมเปญนี้");
      }

      const doc = new PDFDocument({
        size: "A4",
        layout: "landscape",
        margins: { top: 40, bottom: 40, left: 40, right: 40 },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(c));
      const pdfPromise = new Promise<Buffer>((resolve, reject) => {
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);
      });

      let firstPage = true;

      for (const bag of bagRows) {
        const bagId = bag.bag_id;   // 👈 ใช้ bag.bag_id ไม่ใช่ bag.id

        if (!firstPage) {
          doc.addPage({
            size: "A4",
            layout: "landscape",
            margins: { top: 40, bottom: 40, left: 40, right: 40 },
          });
        } else {
          firstPage = false;
        }

        const info = await getInfomation(bagId);

        const report = await GradingReportService.getBagScoresReport(bagId, 0);
        const { booklets, questionCount } = report;

        GradingReportService.drawBagScorePage(
          doc,
          info,
          booklets,
          questionCount
        );
      }

      doc.end();
      return pdfPromise;
    } finally {
      conn.release();
    }
  }
  static async generateGraderBagSummaryPdf(
    bagId: number,
    graderId: number,
    graderName: string   // ส่งมาจาก controller ก็ได้
  ): Promise<Buffer> {
    const conn = await DB.getInstance().getConnection();
    try {
      const info = await getInfomation(bagId); // มี bag_no, subject_name, year_be, site, ฯลฯ
      const graderInfo = await getGraderInfo(conn , bagId , graderId)
      console.log(graderInfo)
      const rows: GraderBagSummaryRow[] = await getGraderBagSummary(
        conn,
        bagId,
        graderId
      );

      const doc = new PDFDocument({
        size: "A4",
        layout: "portrait",    // ใบตัวอย่างเป็นแนวตั้ง
        margins: { top: 60, bottom: 50, left: 50, right: 50 },
      });

      const fontNormal = path.join(__dirname, "../fonts/THSarabunNew.ttf");
      const fontBold = path.join(__dirname, "../fonts/THSarabunNew-Bold.ttf");

      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(c));
      const pdfPromise = new Promise<Buffer>((resolve, reject) => {
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);
      });

      const pageWidth = doc.page.width;
      const { left, right, bottom } = doc.page.margins;

      /* ===== มุมขวาบน: ถุงที่ XX ===== */
      doc
        .font(fontNormal)
        .fontSize(30)
        .text(
          `ถุงที่ ${info?.bag_no ?? ""}`,
          left,
          30,
          {
            width: pageWidth - left - right,
            align: "right",
          }
        );

      /* ===== Header กลาง ===== */
      doc
        .font(fontBold)
        .fontSize(16)
        .text("ใบบันทึกคะแนนผู้ตรวจ", { align: "center" });

      doc.moveDown(0.3);
      doc
        .font(fontNormal)
        .fontSize(14)
        .text(
          `วิชา ${info?.subject_name ?? ""}   ปี พ.ศ. ${info?.year_be ?? ""}`,
          { align: "center" }
        );
      doc.moveDown(0.3);
      doc
        .font(fontNormal)
        .fontSize(14)
        .text(
          `ข้อ ${graderInfo?.question_no}  ผู้ตรวจคนที่ ${graderInfo?.grader_order}`,
          { align: "center" }
        );
      doc.moveDown(0.3);
      doc
        .font(fontNormal)
        .fontSize(14)
        .text(
          `ชื่อ ${graderInfo?.full_name} `,
          { align: "center" }
        );

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

      const colNoWidth = 40;        // คอลัมน์ลำดับ fix ไว้
      const colScoreWidth = 100;    // กว้างของคอลัมน์คะแนน (ปรับได้)
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
        if (y + rowHeight > doc.page.height - bottom) {
          doc.addPage({ layout: "portrait" });

          // ถุงที่ และ header เล็ก ๆ บนหน้าใหม่ (ถ้าต้องการ)
          doc
            .font(fontNormal)
            .fontSize(30)
            .text(
              `ถุงที่ ${info?.bag_no ?? ""} (ต่อ)`,
              left,
              30,
              { width: pageWidth - left - right, align: "right" }
            );

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
        ensurePage();

        const qrText = row.qr_payload ?? "-";
        const scoreText =
          row.total_score != null ? Number(row.total_score).toFixed(0) : "";

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
          width: colScoreWidth,  // ให้กินทั้งช่อง
          align: "center",       // จัดกลางแนวนอน
        });

        // หมายเหตุปล่อยว่างให้เขียนเอง
        y += rowHeight;
      });

      doc.end();
      return pdfPromise;
    } finally {
      conn.release();
    }
  }
  static async generatePassListPdf(opts: {
    campaignId: number;
    sort: string;
    order: string;
    includeScore: boolean;
  }): Promise<Buffer> {
    const sort = (opts.sort as SortKey) || "score";
    const order = (opts.order as SortOrder) || "desc";

    // 1) data
    const { examInfo, rows } = await passlistRepo.getPassListRows({
      campaignId: opts.campaignId,
      sort,
      order,
    });

    // 2) pdf doc
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 40, bottom: 40, left: 48, right: 48 },
      autoFirstPage: true,
    });

    const fontNormal = path.join(__dirname, "../fonts/THSarabunNew.ttf");
    const fontBold = path.join(__dirname, "../fonts/THSarabunNew-Bold.ttf");

    const buffers: Buffer[] = [];
    doc.on("data", (b) => buffers.push(b));
    const pdfPromise = new Promise<Buffer>((resolve, reject) => {
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
      .text(
        "(แนบท้ายประกาศ...)",
        { align: "center" }
      );
    doc.moveDown(0.2);

    doc
      .font(fontNormal)
      .fontSize(12)
      .text(
        `อัยการผู้ช่วย พ.ศ.${examInfo.year_be} (${examInfo.campaign_size})`,
        { align: "center" }
      );

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
      if (opts.includeScore) doc.moveTo(x4, y).lineTo(x4, y + headerH).stroke();

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
      ensureSpace();

      doc.rect(startX, y, tableWidth, rowH).stroke();
      doc.moveTo(x2, y).lineTo(x2, y + rowH).stroke();
      doc.moveTo(x3, y).lineTo(x3, y + rowH).stroke();
      if (opts.includeScore) doc.moveTo(x4, y).lineTo(x4, y + rowH).stroke();

      const ty = y + 3;

      doc.text(String(idx + 1), x1, ty, { width: colW[0], align: "center" });
      doc.text(r.userCode, x2, ty, { width: colW[1], align: "center" });

      const fullName = `${r.title ?? ""}${r.title ? " " : ""}${r.fullName}`;
      doc.text(fullName, x3 + 6, ty, { width: colW[2] - 12, align: "left" });

      if (opts.includeScore) {
        doc.text(
          r.finalScore == null ? "-" : Number(r.finalScore).toFixed(2),
          x4,
          ty,
          { width: colW[3], align: "center" }
        );
      }

      y += rowH;
    });

    doc.end();
    return pdfPromise;
  }



}
