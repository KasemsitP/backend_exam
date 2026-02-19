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

    const questionCount = questionCountD ?? 0;

    // 2. Map Label เก็บไว้ใช้ง่ายๆ
    // (จริงๆ ตัวแปรนี้ไม่ได้ใช้ในการคำนวณข้างล่าง แต่เตรียมไว้ return)
    
    // 3. Group ข้อมูลตาม Booklet (เล่ม)
    const byBooklet = new Map<number, BagBookletGraderBlock>();

    for (const r of raw) {
      const bookletId = Number(r.booklet_id);
      const examCode = safeText(r.exam_code); // หรือ user_code
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
      const fontNormal = path.join(__dirname, "../fonts/THSarabunNew.ttf");
      const fontBold = path.join(__dirname, "../fonts/THSarabunNew-Bold.ttf");

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
      
      const fontNormal = path.join(__dirname, "../fonts/THSarabunNew.ttf");
      const fontBold = path.join(__dirname, "../fonts/THSarabunNew-Bold.ttf");

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
    const { info, booklets, questionCount, questionLabels } = report;

    const pageWidth = doc.page.width;
    const { left, right, bottom } = doc.page.margins;
    const tableWidth = pageWidth - left - right;

    const labelMap = new Map<number, string>(
        questionLabels.map((q) => [q.question_no, q.label])
    );

    // --- Header ---
    doc
      .font(fontNormal)
      .fontSize(30)
      .text(`ถุงที่ ${info.bag_no}`, left, 20, {
        width: pageWidth - left - right,
        align: "right",
      });

    doc.font(fontBold).fontSize(16).text(
      `เอกสารรายชื่อผู้ตรวจรายข้อ`,
      { align: "center" }
    );
    doc.moveDown(0.2);

    doc.font(fontNormal).fontSize(13).text(
      `${info.campaign_name ?? "-"}  พ.ศ.${info.year_be} (${info.campaign_size})`,
      { align: "center" }
    );
    doc.font(fontNormal).fontSize(13).text(`ณ ${info.site}`, { align: "center" });

    doc.moveDown(0.2);
    doc.font(fontNormal).fontSize(14).text(`วิชา ${info.subject_name}`, { align: "center" });
    doc.moveDown(0.8);

    // --- Table Config ---
    const colCodeWidth = 60;
    const colsPerQuestion = 2; // ผู้ตรวจ1, ผู้ตรวจ2
    const colPerCellWidth = 58; // ความกว้างช่องชื่อผู้ตรวจ
    const totalQuestionCols = questionCount * colsPerQuestion;

    const usedWidth = colCodeWidth + totalQuestionCols * colPerCellWidth;
    // ถ้าตารางล้นหน้า ให้ย่อส่วน (Scale down)
    const scale = usedWidth > tableWidth ? tableWidth / usedWidth : 1;

    const cwCode = colCodeWidth * scale;
    const cwCell = colPerCellWidth * scale;

    const startX = left;
    let y = doc.y;

    const rowH1 = 38;  // ความสูง Header แถวบน (ข้อ + Label)
    const rowH2 = 16;  // ความสูง Header แถวล่าง (ผู้ตรวจ 1/2)
    const rowH = 16;   // ความสูง Row ข้อมูล

    // ฟังก์ชันเช็คหน้ากระดาษ
    const ensurePage = () => {
      if (y + rowH > doc.page.height - bottom) {
        doc.addPage({ layout: "landscape" });
        y = doc.page.margins.top;
        drawHeader(); // วาดหัวตารางซ้ำในหน้าใหม่
      }
    };

    // ฟังก์ชันวาดหัวตาราง
    const drawHeader = () => {
      let x = startX;

      doc.lineWidth(0.5).strokeColor("black");
      doc.font(fontBold).fontSize(10);

      // 1. ช่องรหัส (กินพื้นที่แนวตั้ง 2 แถว)
      doc.rect(x, y, cwCode, rowH1 + rowH2).stroke();
      doc.text("รหัส", x, y + 8, { width: cwCode, align: "center" });
      x += cwCode;

      // 2. Loop วาดหัวข้อ (แถวบน)
      for (let q = 1; q <= questionCount; q++) {
        const groupW = colsPerQuestion * cwCell;
        const label = labelMap.get(q) ?? "";
        
        doc.rect(x, y, groupW, rowH1).stroke();
        doc.text(`ข้อ ${q}\n${label}`, x, y + 3, {
          width: groupW,
          align: "center",
          ellipsis: true,
        });
        x += groupW;
      }

      // 3. Loop วาดหัวข้อย่อย (แถวล่าง: ผู้ตรวจ 1 / 2)
      y += rowH1;
      x = startX + cwCode;
      
      const sub = ["ผู้ตรวจ 1", "ผู้ตรวจ 2"];
      for (let q = 1; q <= questionCount; q++) {
        for (let i = 0; i < 2; i++) {
          doc.rect(x, y, cwCell, rowH2).stroke();
          doc.text(sub[i], x, y + 3, { width: cwCell, align: "center" });
          x += cwCell;
        }
      }

      // ปิดท้ายหัวตาราง
      y += rowH2;
      doc.font(fontNormal).fontSize(9);
    };

    // เริ่มวาดหัวตารางครั้งแรก
    drawHeader();

    // --- Table Body (Loop Booklets) ---
    doc.font(fontNormal).fontSize(9);

    for (const bk of booklets) {
      ensurePage();

      let x = startX;

      // 1. รหัสสอบ
      doc.rect(x, y, cwCode, rowH).stroke();
      doc.text(bk.examCode, x + 2, y + 3, { width: cwCode - 4, align: "left" });
      x += cwCode;

      // 2. Loop แต่ละข้อ
      for (let q = 1; q <= questionCount; q++) {
        const cell = bk.questions[q - 1];

        // ตัดคำถ้ายาวเกินไป
        const g1 = cell?.grader1Name ? cell.grader1Name.split(" ")[0] : "";
        const g2 = cell?.grader2Name ? cell.grader2Name.split(" ")[0] : "";

        // ช่องผู้ตรวจ 1
        doc.rect(x, y, cwCell, rowH).stroke();
        doc.text(g1, x + 2, y + 3, { width: cwCell - 4, align: "center" });
        x += cwCell;

        // ช่องผู้ตรวจ 2
        doc.rect(x, y, cwCell, rowH).stroke();
        doc.text(g2, x + 2, y + 3, { width: cwCell - 4, align: "center" });
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