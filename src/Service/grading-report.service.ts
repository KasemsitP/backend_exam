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
  getGraderInfo,
  findQuestionLabelForBagSubject
} from "../Repo/grading-report.repo";

import passlistRepo, { PassListRow } from "../Repo/passlist.repo";

import rankingRepo, { RankingRawRow } from "../Repo/ranking-report.repo";

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
type GroupItem = { sessionId: number; subjectId: number; questionNo: number };
type GroupRule = { title: string; items: GroupItem[] };
type SortBy = "TOTAL_DESC" | "TOTAL_ASC" | "EXAMCODE_ASC" | "EXAMCODE_DESC" | "NAME_ASC" | "NAME_DESC";

// Helper สร้าง Key สำหรับ Map
function keyOf(sessionId: number, subjectId: number, questionNo: number) {
  return `${sessionId}:${subjectId}:${questionNo}`;
}

// โครงสร้างข้อมูล User ระหว่างคำนวณ
type RankingUserData = {
  userCode: string;
  title: string | null;
  fullName: string;
  roomCode: string | null;
  seatCode: string | null;

  totalScore: number;         // คะแนนรวมทั้งหมด (จาก subjectIds ที่เลือก)
  groupScores: number[];      // คะแนนตามกลุ่ม Tie-break [กลุ่ม1, กลุ่ม2, ...]

  isCompleted: boolean;       // ตรวจครบทุกข้อหรือไม่
  scoresMap: Map<string, number | null>; // เก็บรายข้อไว้ lookup
};

function compareText(a: string, b: string) {
  return a.localeCompare(b, "th");
}


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
  questionLabels: { question_no: number; label: string }[];
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
    questionCount: number,
    questionLabels: { question_no: number; label: string }[]
  ) {
    const fontNormal = path.resolve("fonts/THSarabunNew.ttf");
    const fontBold = path.resolve("fonts/THSarabunNew-Bold.ttf");

    const pageWidth = doc.page.width;
    const { left, right, bottom } = doc.page.margins;
    const tableWidth = pageWidth - left - right;

    const labelMap = new Map(
      questionLabels.map((q) => [q.question_no, q.label])
    );

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
    const rowH1 = 42;
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
        const label = labelMap.get(q) ?? "";
        doc.rect(x, y, groupWidth, rowH1).stroke();
        doc.text(
          `ข้อ ${q}\n${label}`,
          x,
          y + 4,
          {
            width: groupWidth,
            align: "center",
            ellipsis: true,   // ตัด ...
          }
        );

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

      const questionLabels = await findQuestionLabelForBagSubject(conn, bagId, subjectId)

      console.log("questionLabels", questionLabels)

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
        questionLabels: questionLabels ?? [],
      };
    } finally {
      conn.release();
    }
  }
  static async generateBagScorePdf(bagId: number): Promise<Buffer> {

    const info = await getInfomation(bagId)
    console.log(info)
    // ดึงข้อมูลคะแนนตามถุง
    const reportDB = await GradingReportService.getBagScoresReport(bagId, 0);

    const report = {
      ...reportDB,
      booklets: [...reportDB.booklets].sort((a, b) =>
        a.examCode.localeCompare(b.examCode, undefined, { numeric: true })
      ),
    };



    console.log(report)
    const { booklets, questionCount, questionLabels } = report;

    const labelMap = new Map(
      questionLabels.map((q) => [q.question_no, q.label])
    );

    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",   // 👈 ตรงนี้ทำให้เป็นแนวนอน
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
    });

const fontNormal = path.resolve("fonts/THSarabunNew.ttf");
const fontBold = path.resolve("fonts/THSarabunNew-Bold.ttf");
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
    const rowH1 = 42;
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
        const label = labelMap.get(q) ?? "";

        doc.text(
          `ข้อ ${q}\n${label}`,
          x,
          y + 4,
          {
            width: groupWidth,
            align: "center",
            ellipsis: true,   // ตัด ...
          }
        );
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
            { width: cwScore - 2, align: "center" }
          );
          x += cwScore;
        });

        if (avg != null) totalPerSubject += Number(avg);
      }

      // รวมรายวิชา
      doc.rect(x, y, cwSum, rowHeight).stroke();
      doc.text(totalPerSubject.toFixed(1), x, y + 3, {
        width: cwSum,
        align: "center",
      });
      x += cwSum;

      // รวมทั้งหมด (ถ้าคุณมีอีกวิชา ค่อยเติม logic)
      doc.rect(x, y, cwSum, rowHeight).stroke();
      doc.text(totalPerSubject.toFixed(1), x, y + 3, {
        width: cwSum,
        align: "center",
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
        const { booklets, questionCount, questionLabels } = report;

        GradingReportService.drawBagScorePage(
          doc,
          info,
          booklets,
          questionCount,
          questionLabels
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
      const graderInfo = await getGraderInfo(conn, bagId, graderId)
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

const fontNormal = path.resolve("fonts/THSarabunNew.ttf");
const fontBold = path.resolve("fonts/THSarabunNew-Bold.ttf");

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

const fontNormal = path.resolve("fonts/THSarabunNew.ttf");
const fontBold = path.resolve("fonts/THSarabunNew-Bold.ttf");
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

  static async generateRankingPdf(opts: {
    campaignId: number;
    subjectIds: number[];
    sortBy: string;
    includeRankNo: boolean;
    includeRoomSeat: boolean;
    includeAvgExplain: boolean;
    onlyCompleted: boolean;
    limit: number;
    groups: GroupRule[];
  }): Promise<Buffer> {

    // 1. ดึงข้อมูล Campaign และ คะแนนดิบ
    const examInfo = await rankingRepo.getExamInfo(opts.campaignId);
    const rawData = await rankingRepo.getRankingRawRows({
      campaignId: opts.campaignId,
      subjectIds: opts.subjectIds,
    });

    // 2. Aggregate Data by User
    const usersMap = new Map<string, RankingUserData>();

    for (const row of rawData) {
      if (!usersMap.has(row.user_code)) {
        usersMap.set(row.user_code, {
          userCode: row.user_code,
          title: row.title,
          fullName: row.full_name,
          roomCode: row.room_code,
          seatCode: row.seat_code,
          totalScore: 0,
          groupScores: [],
          isCompleted: true, // ตั้งต้น true, ถ้าเจอข้อไหนไม่ครบจะปรับเป็น false
          scoresMap: new Map(),
        });
      }

      const user = usersMap.get(row.user_code)!;
      const key = keyOf(row.session_id, row.subject_id, row.question_no);

      // เก็บลง Map รายข้อ
      user.scoresMap.set(key, row.avg_score);

      // เช็คว่าตรวจครบไหม (ถ้าข้อนี้ has_both=0 แสดงว่าไม่ครบ)
      if (!row.has_both) {
        user.isCompleted = false;
      }

      // บวกคะแนนเข้า Total Score (นับทุกข้อที่ Query มา)
      // *สำคัญ* ตรงนี้คือคะแนนรวมจริง ไม่เกี่ยวกับกลุ่ม Tie-break
      if (row.avg_score != null) {
        user.totalScore += Number(row.avg_score);
      }
    }

    // 3. คำนวณคะแนนตาม Group (Tie-breaker)
    const groups = opts.groups || [];

    for (const user of usersMap.values()) {
      // วนลูปตามกลุ่มที่ User ตั้งไว้ (เช่น กฎหมายอาญา, กฎหมายแพ่ง)
      const gScores: number[] = groups.map((group) => {
        let sum = 0;
        // รวมคะแนนเฉพาะข้อที่อยู่ในกลุ่มนี้
        for (const item of group.items) {
          const k = keyOf(item.sessionId, item.subjectId, item.questionNo);
          const sc = user.scoresMap.get(k);
          if (sc != null) sum += Number(sc);
        }
        return sum;
      });

      user.groupScores = gScores;
    }

    // 4. แปลงเป็น Array และ Filter
    let rankingList = Array.from(usersMap.values());

    if (opts.onlyCompleted) {
      rankingList = rankingList.filter((u) => u.isCompleted);
    }

    // 5. Sorting Logic (หัวใจสำคัญ)
    const sortBy = (opts.sortBy || "TOTAL_DESC") as SortBy;

    rankingList.sort((a, b) => {
      // 5.1 Sort ตามชื่อ หรือ รหัส (กรณีเลือก Sort แบบพิเศษ)
      if (sortBy === "EXAMCODE_ASC") return a.userCode.localeCompare(b.userCode);
      if (sortBy === "EXAMCODE_DESC") return b.userCode.localeCompare(a.userCode);
      if (sortBy === "NAME_ASC") return a.fullName.localeCompare(b.fullName, "th");
      if (sortBy === "NAME_DESC") return b.fullName.localeCompare(a.fullName, "th");

      // 5.2 Sort ตามคะแนนรวม (TOTAL) เป็นหลัก
      const dir = sortBy === "TOTAL_ASC" ? 1 : -1; // ปกติ DESC (-1)

      if (Math.abs(a.totalScore - b.totalScore) > 0.0001) {
        return (a.totalScore - b.totalScore) * dir;
      }

      // 5.3 Tie-break: คะแนนรวมเท่ากัน -> ดูคะแนน Group ตามลำดับ
      for (let i = 0; i < groups.length; i++) {
        const scoreA = a.groupScores[i];
        const scoreB = b.groupScores[i];

        if (Math.abs(scoreA - scoreB) > 0.0001) {
          // คะแนนกลุ่มมาก = อันดับดีกว่า (ใช้ dir เหมือน Total)
          return (scoreA - scoreB) * dir;
        }
      }

      // 5.4 ยังเท่ากันอีก -> เรียงตามรหัสสอบ (น้อยไปมาก)
      return a.userCode.localeCompare(b.userCode);
    });

    // 6. Limit Top N (ถ้ามี)
    if (opts.limit > 0) {
      rankingList = rankingList.slice(0, opts.limit);
    }

    // 7. Generate PDF
    return GradingReportService.createRankingPdfDocument(rankingList, examInfo, opts);
  }

  // แยก function สร้าง PDF ออกมาเพื่อให้โค้ดสะอาด
  // แยก function สร้าง PDF ออกมาเพื่อให้โค้ดสะอาด
  private static createRankingPdfDocument(
    data: RankingUserData[],
    info: any,
    opts: any
  ): Promise<Buffer> {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      autoFirstPage: true,
    });

const fontNormal = path.resolve("fonts/THSarabunNew.ttf");
const fontBold = path.resolve("fonts/THSarabunNew-Bold.ttf");
    const buffers: Buffer[] = [];
    doc.on("data", (b) => buffers.push(b));

    const pdfPromise = new Promise<Buffer>((resolve, reject) => {
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);
    });

    // --- PDF Content Drawing ---
    const drawHeaderInfo = () => {
      doc.font(fontBold).fontSize(16).text("บัญชีรายชื่อเรียงลำดับคะแนน", { align: "center" });
      doc.font(fontNormal).fontSize(12).text(
        `สนามสอบ: ${info.site} (${info.campaign_size} ${info.year_be})`,
        { align: "center" }
      );
      doc.moveDown(0.5);
    };

    drawHeaderInfo();

    const pageWidth = doc.page.width - 80; // margins left+right
    const colWidths = [
      pageWidth * 0.1,  // ลำดับ
      pageWidth * 0.2,  // รหัส
      pageWidth * 0.4,  // ชื่อ
      pageWidth * 0.15, // ห้อง/ที่นั่ง
      pageWidth * 0.15  // คะแนนรวม
    ];

    const headers = ["ลำดับ", "รหัสประจำตัว", "ชื่อ-สกุล", "คะแนนรวม"];

    // ฟังก์ชันวาดหัวตาราง (ใช้ซ้ำตอนขึ้นหน้าใหม่)
    const drawTableHeader = (currentY: number) => {
      let currentX = 40;
      doc.font(fontBold).fontSize(12);

      // วาดกรอบสี่เหลี่ยมรอบหัวตาราง
      doc.lineWidth(0.5).rect(currentX, currentY, pageWidth, 20).stroke();

      headers.forEach((h, i) => {
        // วาดข้อความ
        doc.text(h, currentX, currentY + 5, { width: colWidths[i], align: "center" });

        // ขยับ X ไปจบที่ขอบขวาของคอลัมน์นี้
        currentX += colWidths[i];

        // วาดเส้นแนวตั้ง (ยกเว้นคอลัมน์สุดท้าย เพราะมีกรอบขวาอยู่แล้ว)
        if (i < headers.length - 1) {
          doc.moveTo(currentX, currentY)
            .lineTo(currentX, currentY + 20)
            .stroke();
        }
      });
    };

    // เริ่มวาดหัวตารางครั้งแรก
    let y = doc.y;
    drawTableHeader(y);
    y += 20;

    // Body
    doc.font(fontNormal).fontSize(12);

    data.forEach((row, idx) => {
      // Check Page Break
      if (y > doc.page.height - 50) {
        doc.addPage();
        drawHeaderInfo(); // วาดหัวกระดาษซ้ำ
        y = doc.y;
        drawTableHeader(y); // วาดหัวตารางซ้ำ
        y += 20;
        doc.font(fontNormal);
      }

      let x = 40;
      // วาดกรอบสี่เหลี่ยมรอบแถว (Row Border)
      doc.rect(x, y, pageWidth, 20).stroke();

      // 1. ลำดับ
      // if (opts.includeRankNo) {
      //      doc.text(String(idx + 1), x, y + 4, { width: colWidths[0], align: "center" });
      // }

      doc.text(String(idx + 1), x, y + 4, { width: colWidths[0], align: "center" });
      x += colWidths[0];
      // เส้นคั่นแนวตั้งหลังจบช่องลำดับ
      doc.moveTo(x, y).lineTo(x, y + 20).stroke();

      // 2. รหัส
      doc.text(row.userCode, x, y + 4, { width: colWidths[1], align: "center" });
      x += colWidths[1];
      // เส้นคั่นแนวตั้งหลังจบช่องรหัส
      doc.moveTo(x, y).lineTo(x, y + 20).stroke();

      // 3. ชื่อ
      const name = `${row.title ? row.title : ''}${row.fullName}`;
      doc.text(name, x + 5, y + 4, { width: colWidths[2] - 10, align: "left" });
      x += colWidths[2];
      // เส้นคั่นแนวตั้งหลังจบช่องชื่อ
      doc.moveTo(x, y).lineTo(x, y + 20).stroke();

      // // 4. ที่นั่ง
      // if (opts.includeRoomSeat) {
      //     doc.text(`${row.roomCode || '-'}/${row.seatCode || '-'}`, x, y + 4, { width: colWidths[3], align: "center" });
      // }
      // x += colWidths[3];
      // // เส้นคั่นแนวตั้งหลังจบช่องที่นั่ง
      // doc.moveTo(x, y).lineTo(x, y + 20).stroke();

      // 5. คะแนนรวม (ไม่ต้องตีเส้นปิดท้าย เพราะมีกรอบ rect วาดไว้แล้ว)
      doc.text(row.totalScore.toFixed(2), x, y + 4, { width: colWidths[4], align: "center" });

      y += 20;
    });

    doc.end();
    return pdfPromise;
  }


}
