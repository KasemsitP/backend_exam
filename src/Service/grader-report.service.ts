// src/Service/grader-report.service.ts

import { DB } from "../model/DB";
import { PoolConnection } from "mysql2/promise";
import path from "path";
import PDFDocument from "pdfkit";
import graderReportRepo from "../Repo/grader-report.repo";

// Import Types จาก Repo (หรือจะ define ใหม่ถ้าใน Repo ไม่ได้ export)
// สมมติว่าใน Repo export type เหล่านี้มาแล้ว ถ้ายังให้ copy interface ไปใส่ใน Repo แล้ว export ครับ
import {
  BagGradersReport,
  BagBookletGraderBlock,
  BagBookletGraderCell
} from "../Repo/grader-report.repo";
import { getUnlockCampaignByBagId } from "../Repo/grading-report.repo";

// --- Helper Functions ---
function safeText(s: any): string {
  return typeof s === "string" ? s : s == null ? "" : String(s);
}

function ellipsisName(s: string, max = 18): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

export class GraderReportService {

  // ===========================================================================
  // 1. DATA FETCHING (Logic หลักในการดึงข้อมูล)
  // ===========================================================================

  /** * ดึงข้อมูลเพื่อเตรียมทำ Report 
   * **สำคัญ:** รับ `conn` เข้ามาเพื่อใช้ต่อ ไม่ต้องสร้างใหม่ 
   */
  static async getBagGradersReport(
    bagId: number,
    subjectId: number,
    conn: PoolConnection
  ): Promise<BagGradersReport> {

    // 1. ดึงข้อมูลพื้นฐาน (ใช้ conn ที่ส่งมา)
    const infoRow = await graderReportRepo.getBagInfo(conn, bagId, subjectId);
    const questionCountD = await graderReportRepo.getQuestionCountForBagSubject(conn, bagId, subjectId);
    const questionLabels = await graderReportRepo.getQuestionLabels(conn, subjectId);
    const raw = await graderReportRepo.getBookletGraderRows(conn, { bagId, subjectId });

    const result_is_unlock = await getUnlockCampaignByBagId(conn, bagId)
    //  console.log(result_is_unlock)


    console.log(result_is_unlock[0].campaign_id)

    const unlock = result_is_unlock[0].is_unlock



    const questionCount = questionCountD ?? 0;

    // 2. Map Label เก็บไว้ใช้ง่ายๆ
    // (จริงๆ ตัวแปรนี้ไม่ได้ใช้ในการคำนวณข้างล่าง แต่เตรียมไว้ return)

    // 3. Group ข้อมูลตาม Booklet (เล่ม)
    const byBooklet = new Map<number, BagBookletGraderBlock>();

    for (const r of raw) {
      const bookletId = Number(r.booklet_id);

      const user_code = unlock ? r.exam_code : r.random_num
      const examCode = safeText(user_code); // หรือ user_code
      const qNo = Number(r.question_no);

      if (!byBooklet.has(bookletId)) {
        // สร้าง Array ว่างๆ รอไว้ให้ครบจำนวนข้อ
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

      // Safety check: กันเหนียวเผื่อ qNo หลุด range
      if (qNo > 0 && qNo <= questionCount) {
        const cell = bk.questions[qNo - 1];
        cell.grader1Name = r.grader1_name ? safeText(r.grader1_name) : null;
        cell.grader2Name = r.grader2_name ? safeText(r.grader2_name) : null;
        cell.grader1HasScore = r.grader1_score != null;
        cell.grader2HasScore = r.grader2_score != null;
      }
    }

    // 4. Sort ตามรหัสสอบ
    const booklets = Array.from(byBooklet.values()).sort((a, b) =>
      a.examCode.localeCompare(b.examCode, undefined, { numeric: true })
    );

    // 5. Return ผลลัพธ์
    return {
      bagId,
      subjectId,
      questionCount,
      questionLabels, // ส่งต่อ structure เดิม
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

  // ===========================================================================
  // 2. PDF GENERATION (สร้างไฟล์ PDF)
  // ===========================================================================

  /**
   * สร้าง PDF สำหรับ "1 ถุง" (Single Bag)
   */
  static async generateBagGraderPdf(bagId: number): Promise<Buffer> {
    const conn = await DB.getInstance().getConnection();
    try {
      const subjectId = await graderReportRepo.getDerivedSubjectIdForBag(conn, bagId);
      const report = await this.getBagGradersReport(bagId, subjectId, conn);

      // ตั้งค่า PDF
      const doc = new PDFDocument({
        size: "A4",
        layout: "landscape",
        margins: { top: 40, bottom: 40, left: 40, right: 40 },
      });

      // เตรียม Promise สำหรับ Buffer
      const bufferPromise = this.streamToBuffer(doc);

      // Font Paths
      const fontNormal = path.resolve("fonts/THSarabunNew.ttf");
      const fontBold = path.resolve("fonts/THSarabunNew-Bold.ttf");

      // วาดหน้ากระดาษ
      this.drawBagGraderMatrixPage(doc, report, fontNormal, fontBold);

      doc.end();
      return await bufferPromise;

    } finally {
      conn.release(); // คืน Connection เสมอ
    }
  }

  /**
   * สร้าง PDF สำหรับ "ทุกถุงใน Campaign" (All Bags)
   * **Optimized:** ใช้ Connection เดียววนลูป
   */
  static async generateCampaignAllBagsGradersPdf(campaignId: number): Promise<Buffer> {
    const conn = await DB.getInstance().getConnection();

    try {
      // 1. ดึงรายชื่อถุงทั้งหมดมาก่อน
      const bags = await graderReportRepo.getAllBags(conn, campaignId);

      if (!bags.length) {
        throw new Error("ไม่พบถุงในแคมเปญนี้");
      }

      // ตั้งค่า PDF (autoFirstPage: false เพราะเราจะ addPage เองในลูป)
      const doc = new PDFDocument({
        size: "A4",
        layout: "landscape",
        margins: { top: 40, bottom: 40, left: 40, right: 40 },
        autoFirstPage: false
      });

      const bufferPromise = this.streamToBuffer(doc);

      const fontNormal = path.resolve("fonts/THSarabunNew.ttf");
      const fontBold = path.resolve("fonts/THSarabunNew-Bold.ttf");

      // 2. วนลูปถุง ทีละใบ
      for (const b of bags) {
        // สร้างหน้าใหม่ทุกครั้งที่ขึ้นถุงใหม่
        doc.addPage({
          size: "A4",
          layout: "landscape",
          margins: { top: 40, bottom: 40, left: 40, right: 40 }
        });

        // 3. หา subjectId ของถุงนี้ (เพราะ All Bags loop เราไม่รู้ subjectId จาก URL)
        const subjectId = await graderReportRepo.getDerivedSubjectIdForBag(conn, b.bag_id);

        // 4. ดึงข้อมูล (Reuse Connection!)
        const report = await this.getBagGradersReport(b.bag_id, subjectId, conn);

        // 5. วาดลง PDF
        this.drawBagGraderMatrixPage(doc, report, fontNormal, fontBold);
      }

      doc.end();
      return await bufferPromise;

    } finally {
      conn.release(); // คืน Connection เดียวเมื่อจบงานทั้งหมด
    }
  }

  // ===========================================================================
  // 3. PDF DRAWING UTILS (วาดตารางและเนื้อหา)
  // ===========================================================================

  /**
   * ฟังก์ชันวาดเนื้อหาลงในหน้า PDF (ใช้ร่วมกันทั้ง Single และ Campaign)
   */
private static drawBagGraderMatrixPage(
  doc: PDFKit.PDFDocument,
  report: BagGradersReport,
  fontNormal: string,
  fontBold: string
) {
  const { info, booklets, questionCount, questionLabels, unlock } = report;

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const { left, right, top, bottom } = doc.page.margins;

  const contentWidth = pageWidth - left - right;

  const labelMap = new Map<number, string>(
    questionLabels.map(q => [q.question_no, q.label])
  );

  const user_code_title =
    unlock === 1 ? "รหัสประจำตัวสอบ" : "เลขรหัส";

  // =====================================================
  // ====================== HEADER =======================
  // =====================================================

  let y = top;

  const headerY = y;

  // ✅ TITLE (กลาง)
  doc.font(fontBold).fontSize(16).text(
    "เอกสารรายชื่อผู้ตรวจรายข้อ",
    left,
    headerY,
    { width: contentWidth, align: "center" }
  );

  // ✅ BAG NO (ขวา) — ระนาบเดียวกัน
  doc.font(fontNormal).fontSize(30).text(
    `ถุงที่ ${info.bag_no}`,
    left,
    headerY,
    { width: contentWidth, align: "right" }
  );

  y = headerY + 24;

  doc.font(fontNormal).fontSize(12).text(
    `${info.campaign_name ?? "-"}  พ.ศ.${info.year_be} (${info.campaign_size})`,
    left,
    y,
    { width: contentWidth, align: "center" }
  );

  y = doc.y + 2;

  doc.text(`ณ ${info.site}`, left, y, {
    width: contentWidth,
    align: "center"
  });

  y = doc.y + 6;

  doc.font(fontNormal).fontSize(13).text(
    `วิชา ${info.subject_name}`,
    left,
    y,
    { width: contentWidth, align: "center" }
  );

  // ===== เริ่มพื้นที่ตาราง =====
  y = doc.y + 10;

  // =====================================================
  // ================= TABLE CONFIG ======================
  // =====================================================

  const totalRows = 30;

  const colCodeWidth = 60;
  const colsPerQuestion = 2;
  const colPerCellWidth = 58;

  const baseRowH1 = 34;
  const baseRowH2 = 14;
  const baseRowH = 16;

  const totalQuestionCols = questionCount * colsPerQuestion;
  const usedWidth =
    colCodeWidth + totalQuestionCols * colPerCellWidth;

  const tableWidth = contentWidth;

  const widthScale =
    usedWidth > tableWidth ? tableWidth / usedWidth : 1;

  const availableHeight =
    pageHeight - bottom - y;

  const headerHeight = baseRowH1 + baseRowH2;
  const bodyHeight = totalRows * baseRowH;
  const needHeight = headerHeight + bodyHeight;

  const heightScale =
    needHeight > availableHeight
      ? availableHeight / needHeight
      : 1;

  const scale = Math.min(widthScale, heightScale, 1);

  // ===== scaled =====
  const cwCode = colCodeWidth * scale;
  const cwCell = colPerCellWidth * scale;

  const rowH1 = baseRowH1 * scale;
  const rowH2 = baseRowH2 * scale;
  const rowH = baseRowH * scale;

  const fontHeader = Math.max(7, 10 * scale);
  const fontBody = Math.max(6, 9 * scale);

  const startX = left;

  // =====================================================
  // ================= TABLE HEADER ======================
  // =====================================================

  const drawHeader = () => {
    let x = startX;

    doc.lineWidth(0.5).strokeColor("black");
    doc.font(fontBold).fontSize(fontHeader);

    // ช่องรหัส
    doc.rect(x, y, cwCode, rowH1 + rowH2).stroke();
    doc.text(user_code_title, x, y + 4 * scale, {
      width: cwCode,
      align: "center"
    });

    x += cwCode;

    // ข้อสอบ
    for (let q = 1; q <= questionCount; q++) {
      const groupW = colsPerQuestion * cwCell;
      const label = labelMap.get(q) ?? "";

      doc.rect(x, y, groupW, rowH1).stroke();

      doc.text(`ข้อ ${q}\n${label}`, x, y + 2 * scale, {
        width: groupW,
        align: "center",
        ellipsis: true
      });

      x += groupW;
    }

    y += rowH1;
    x = startX + cwCode;

    const sub = ["ผู้ตรวจ 1", "ผู้ตรวจ 2"];

    for (let q = 1; q <= questionCount; q++) {
      for (let i = 0; i < 2; i++) {
        doc.rect(x, y, cwCell, rowH2).stroke();
        doc.text(sub[i], x, y + 2 * scale, {
          width: cwCell,
          align: "center"
        });
        x += cwCell;
      }
    }

    y += rowH2;
  };

  drawHeader();

  // =====================================================
  // ================= TABLE BODY ========================
  // =====================================================

  doc.font(fontNormal).fontSize(fontBody);

  for (let i = 0; i < totalRows; i++) {

    const bk = booklets[i];
    let x = startX;

    doc.rect(x, y, cwCode, rowH).stroke();

    if (bk) {
      const textY = y + (rowH - fontBody) / 2;

      doc.text(bk.examCode ?? "", x + 2 * scale, textY, {
        width: cwCode - 4 * scale,
        align: "left",
        ellipsis: true
      });
    }

    x += cwCode;

    for (let q = 1; q <= questionCount; q++) {

      const cell = bk?.questions?.[q - 1];

      const g1 = cell?.grader1Name?.split(" ")[0] ?? "";
      const g2 = cell?.grader2Name?.split(" ")[0] ?? "";

      doc.rect(x, y, cwCell, rowH).stroke();
      doc.text(g1, x, y + 2 * scale, {
        width: cwCell,
        align: "center",
        ellipsis: true
      });

      x += cwCell;

      doc.rect(x, y, cwCell, rowH).stroke();
      doc.text(g2, x, y + 2 * scale, {
        width: cwCell,
        align: "center",
        ellipsis: true
      });

      x += cwCell;
    }

    y += rowH;
  }
}

  /** Helper สำหรับแปลง PDF Stream เป็น Buffer */
  private static streamToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });
  }
}