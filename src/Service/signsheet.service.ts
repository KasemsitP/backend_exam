import QRCode from "qrcode";
import path from "path";
import PDFDocument from "pdfkit";
import signSheetRepo from "../Repo/signsheet.repo";

// --- Interface & Helper ---
type SignSheetRow = {
  firstName: string;
  lastName: string;
  userCode: string;
  roomName: string | null;
  row_no: number | null;
  title: string
  qr_payload: string | null;
  __absIndex?: number;
};

const chunk = <T>(arr: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );

export class SignSheetService {


  static async generateSignSheetPdf(options: {
    session_id: number;
    campaign_id: number;
    course: string;
    org: string;
    sessionText: string;
  }): Promise<Buffer> {
    const { session_id, campaign_id, course, org, sessionText } = options;

    // โหลด Data มาก่อน
    const rows = await this.getRowsForSession(session_id, campaign_id);

    const ROWS_PER_PAGE = 6;
    const tableX = 25;
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 28, bottom: 28, left: 25, right: 25 },
      autoFirstPage: false,
      bufferPages: true, // ช่วยเรื่อง Memory Management ของ PDFKit
    });

    // Pre-load fonts (Load ครั้งเดียว)
    const fontNormal = path.join(__dirname, "../fonts/THSarabunNew.ttf");
    const fontBold = path.join(__dirname, "../fonts/THSarabunNew-Bold.ttf");

    // Setup Buffer Stream
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    const pdfPromise = new Promise<Buffer>((resolve, reject) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });

    // Layout Calculations
    const colWidths = [40, 545.28 - (40 + 120 + 120), 120, 120];
    const x1 = tableX;
    const x2 = x1 + colWidths[0];
    const x3 = x2 + colWidths[1];
    const x4 = x3 + colWidths[2];
    // const x5 = x4 + colWidths[3];

    // แบ่งหน้า
    const pages = chunk(rows, ROWS_PER_PAGE); // สมมติว่ามีฟังก์ชัน chunk แล้ว
    const totalPages = Math.max(1, pages.length);
    if (pages.length === 0) pages.push([]);

    // --- LOOP PAGES ---
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
      let pageRows = pages[pageIndex];
      const pageNo = pageIndex + 1;

      // เติมแถวว่างให้เต็มหน้า (Logic เดิม)
      while (pageRows.length < ROWS_PER_PAGE) {
        // @ts-ignore
        pageRows.push({ title: "", firstName: "", lastName: "", userCode: "", roomName: null, row_no: null, qr_payload: null });
      }

      doc.addPage();

      // 1. Prepare QR Codes for THIS PAGE (Parallel Execution)
      // เทคนิค: Gen QR ของทั้ง 6 คนพร้อมกันในรอบเดียว แทนที่จะรอทีละคน
      const qrBuffers = await Promise.all(
        pageRows.map(async (r) => {
          if (!r.qr_payload) return null;
          try {
            // ลด width จาก 350 เหลือ 200 ก็คมชัดพอสำหรับขนาด 95pt (ช่วยลด CPU/RAM)
            return await QRCode.toBuffer(r.qr_payload, {
              width: 200,
              margin: 1,
              errorCorrectionLevel: 'M' // ใช้ M หรือ L จะเร็วกว่า H/Q
            });
          } catch (e) {
            return null;
          }
        })
      );

      // --- HEADER ---
      doc.font(fontBold).fontSize(16).text(`ใบเซ็นชื่อสอบวิชา ${course}`, { align: "center" });
      doc.moveDown(0.2);
      doc.font(fontNormal).text(`${sessionText}  ณ ${org}`, { align: "center" });
      doc.moveDown(0.1);
      doc.fillColor("#666666").text(`${rows.length} คน | หน้า ${pageNo}/${totalPages}`, { align: "center" });
      doc.moveDown(0.5);

      // --- TABLE STRUCTURE ---
      const headerHeight = 20;
      const rowHeight = 110;
      const startY = doc.y;
      const tableBottomY = startY + headerHeight + (ROWS_PER_PAGE * rowHeight);

      // OPTIMIZATION: วาดเส้นโครงตารางทีเดียว (Batch Draw)
      // เส้นกรอบนอกและเส้นแบ่ง Column ลากยาวจากบนลงล่างทีเดียว ไม่ต้อง Loop วาด
      doc.lineWidth(0.7).strokeColor("black").fillColor("black");

      // เส้นตั้ง (Vertical Lines) - ลากยาวรวดเดียวจบ
      doc.moveTo(x1, startY).lineTo(x1, tableBottomY).stroke(); // ซ้ายสุด
      doc.moveTo(x2, startY).lineTo(x2, tableBottomY).stroke();
      doc.moveTo(x3, startY).lineTo(x3, tableBottomY).stroke();
      doc.moveTo(x4, startY).lineTo(x4, tableBottomY).stroke();
      doc.moveTo(x1 + 545.28, startY).lineTo(x1 + 545.28, tableBottomY).stroke(); // ขวาสุด

      // เส้นนอน (Horizontal Lines)
      // 1. เส้นปิด Header
      doc.moveTo(x1, startY).lineTo(x1 + 545.28, startY).stroke();
      doc.moveTo(x1, startY + headerHeight).lineTo(x1 + 545.28, startY + headerHeight).stroke();

      // --- HEADER TEXT ---
      const textY = startY + 4;
      doc.font(fontBold).fontSize(11).fillColor("black");
      doc.text("ลำดับ", x1, textY, { width: colWidths[0], align: "center" });
      doc.text("ชื่อ-นามสกุล / รหัส / ห้อง", x2 + 6, textY, { width: colWidths[1], align: "left" });
      doc.text("คิวอาร์โค้ดภาคผนวก", x3, textY, { width: colWidths[2], align: "center" });
      doc.text("คิวอาร์โค้ดภาคผนวก", x4, textY, { width: colWidths[3], align: "center" });

      // --- DATA ROWS ---
      let currentY = startY + headerHeight;

      // วนลูปวาดข้อมูล และเส้นคั่นบรรทัด
      for (let i = 0; i < pageRows.length; i++) {
        const r = pageRows[i];
        const qrBuffer = qrBuffers[i]; // ดึงจากที่เรา Gen ไว้แล้ว
        const isBlank = !r.firstName && !r.userCode;
        const absIndex = ((pageIndex) * ROWS_PER_PAGE) + i + 1;

        // เส้นปิดล่างของแถวนี้
        doc.moveTo(x1, currentY + rowHeight).lineTo(x1 + 545.28, currentY + rowHeight).stroke();

        if (!isBlank) {
          const paddingY = currentY + 6;
          const infoX = x2 + 6;

          // Col 1: ลำดับ
          doc.font(fontNormal).fontSize(15).fillColor("black");
          doc.text(String(absIndex), x1, paddingY, { width: colWidths[0], align: "center" });

          // Col 2: Info (Text ทั้งหมด)
          let infoY = paddingY;
          doc.text(`${r.title} ${r.firstName} ${r.lastName}`, infoX, infoY);
          infoY += 20;
          doc.fillColor("#666666").text(`เลขที่นั่งสอบ ${r.userCode || "-"}`, infoX, infoY);
          infoY += 20;
          doc.text(`ห้องสอบ ${r.roomName || "-"}`, infoX, infoY);
          infoY += 20;
          doc.text(`แถวที่ ${r.row_no || "-"}`, infoX, infoY);
          infoY += 20;
          doc.text("ลายเซ็น..................................................", infoX, infoY);

          // Col 3 & 4: QR Code (Image)
          const qrSize = 95;
          const qrY = currentY + (rowHeight - qrSize) / 2;
          const qr1X = x3 + (colWidths[2] - qrSize) / 2;
          const qr2X = x4 + (colWidths[3] - qrSize) / 2;

          if (qrBuffer) {
            // ใส่รูปจาก Buffer ที่เตรียมไว้
            doc.image(qrBuffer, qr1X, qrY, { width: qrSize });
            doc.image(qrBuffer, qr2X, qrY, { width: qrSize });
          } else {
            // NULL Case
            const nullY = currentY + (rowHeight / 2) - 4;
            doc.fillColor("#c00000").font(fontBold).fontSize(9);
            doc.text("NULL (ยังไม่เข้ารหัส)", x3, nullY, { width: colWidths[2], align: "center" });
            doc.text("NULL (ยังไม่เข้ารหัส)", x4, nullY, { width: colWidths[3], align: "center" });
          }
        }

        currentY += rowHeight;
      }

      // *** SUPER IMPORTANT ***
      // สั่งให้ Event Loop หยุดพักเล็กน้อยทุกครั้งที่จบหน้า เพื่อป้องกัน CPU 100% จนเซิร์ฟเวอร์ค้าง
      // จะทำให้ Node.js สามารถรับ Request อื่นแทรกได้ หรือจัดการ Memory ได้
      await new Promise(resolve => setImmediate(resolve));
    }

    doc.end();

    // รอ buffer รวมเสร็จ
    return pdfPromise;
  }
  static async getRowsForSession(
    session_id: number,
    campaign_id: number
  ): Promise<SignSheetRow[]> {
    const list =
      await signSheetRepo.findUserSessionByCampaignAndSession(
        session_id,
        campaign_id
      );
    return list.map((r: any) => ({
      firstName: r.firstName,
      lastName: r.lastName,
      userCode: r.userCode,
      roomName: r.roomName ?? null,
      qr_payload: r.qr_payload ?? null,
      row_no: r.row_no,
      title: r.title
    }));
  }

  //  ใหม่: สำหรับหน้าเว็บ (pagination)
  static async getPaginatedUserSessions(options: {
    session_id: number;
    campaign_id: number;
    page: number;
    limit: number;
    search: string;
  }) {
    const { session_id, campaign_id, page, limit, search } = options;
    return signSheetRepo.findUserSessionsWithPagination(
      session_id,
      campaign_id,
      page,
      limit,
      search
    );
  }

}