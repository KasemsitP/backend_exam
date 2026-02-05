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
  row_no : number | null; 
  title : string
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
    const rows = await this.getRowsForSession(session_id, campaign_id);

    const ROWS_PER_PAGE = 6;

    // 1. Setup Document (Margin ตาม frontend: [25, 28, 25, 28])
    // 25pt = ~8.8mm
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 28, bottom: 28, left: 25, right: 25 },
      autoFirstPage: false,
    });

    // Font Paths
    const fontNormal = path.join(__dirname, "../fonts/THSarabunNew.ttf");
    const fontBold = path.join(__dirname, "../fonts/THSarabunNew-Bold.ttf");

    // Prepare Buffer
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    const pdfPromise = new Promise<Buffer>((resolve, reject) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });

    // 2. Calculation for Columns
    // A4 Width = 595.28 pt
    // Usable Width = 595.28 - 25 - 25 = 545.28 pt
    // Frontend logic: widths: [40, "*", 120, 120]
    const col1_W = 40;
    const col3_W = 120;
    const col4_W = 120;
    const col2_W = 545.28 - (col1_W + col3_W + col4_W); // "*" คือพื้นที่ที่เหลือ

    const colWidths = [col1_W, col2_W, col3_W, col4_W];
    const tableX = 25; // เริ่มที่ margin ซ้าย

    // คำนวณจุด X ของเส้นแบ่ง
    const x1 = tableX;
    const x2 = x1 + colWidths[0];
    const x3 = x2 + colWidths[1];
    const x4 = x3 + colWidths[2];
    const x5 = x4 + colWidths[3]; // ขวาสุด

    // 3. Process Pages
    const pages = chunk(rows, ROWS_PER_PAGE);
    const totalPages = Math.max(1, pages.length);
    if (pages.length === 0) pages.push([]);

    for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
      let pageRows = pages[pageIndex];
      const pageNo = pageIndex + 1;

      // เติมแถวว่าง
      while (pageRows.length < ROWS_PER_PAGE) {
        pageRows.push({ title:"",firstName: "", lastName: "", userCode: "", roomName: null,row_no : null , qr_payload: null });
      }

      doc.addPage();

      // --- HEADER ---
      // 1. ชื่อวิชา (Bold 16, Center)
      doc.font(fontBold).fontSize(16).text(`ใบเซ็นชื่อสอบวิชา ${course}`, { align: "center" });
      doc.moveDown(0.2); // margin bottom 4 roughly

      // 2. วันที่ ณ หน่วยงาน (Normal 11, Center) - Frontend ใช้ default 11pt
      doc.font(fontNormal).fontSize(16).text(`${sessionText}  ณ ${org}`, { align: "center" });
      doc.moveDown(0.1);

      // 3. จำนวนคน | หน้า (Color #666, Size 9)
      doc.fillColor("#666666").fontSize(16)
        .text(`${rows.length} คน | หน้า ${pageNo}/${totalPages}`, { align: "center" });

      doc.moveDown(0.5); // margin bottom 8

      // --- TABLE HEADER ---
      const headerHeight = 20;
      const startY = doc.y;

      // วาดเส้นกรอบ Header
      doc.lineWidth(0.7).strokeColor("black"); // hLineWidth 0.7
      doc.rect(tableX, startY, 545.28, headerHeight).stroke();
      // เส้นตั้ง
      doc.moveTo(x2, startY).lineTo(x2, startY + headerHeight).stroke();
      doc.moveTo(x3, startY).lineTo(x3, startY + headerHeight).stroke();
      doc.moveTo(x4, startY).lineTo(x4, startY + headerHeight).stroke();

      // ข้อความ Header (Bold 11)
      const textY = startY + 4; // padding top
      doc.fillColor("black").font(fontBold).fontSize(11);

      doc.text("ลำดับ", x1, textY, { width: colWidths[0], align: "center" });
      doc.text("ชื่อ-นามสกุล / รหัส / ห้อง", x2 + 6, textY, { width: colWidths[1], align: "left" }); // paddingLeft 6
      doc.text("คิวอาร์โค้ดภาคผนวก", x3, textY, { width: colWidths[2], align: "center" });
      doc.text("คิวอาร์โค้ดภาคผนวก", x4, textY, { width: colWidths[3], align: "center" });

      // --- DATA ROWS ---
      let currentY = startY + headerHeight;
      const rowHeight = 110; // ความสูงแถว (ปรับเพื่อให้ใส่ QR 95pt ได้พอดี + padding)

      for (let i = 0; i < pageRows.length; i++) {
        const r = pageRows[i];
        const isBlank = !r.firstName && !r.userCode;
        const absIndex = (pageIndex * ROWS_PER_PAGE) + i + 1;

        // วาดกรอบสี่เหลี่ยม
        doc.rect(tableX, currentY, 545.28, rowHeight).stroke();

        // เส้นแบ่งแนวตั้ง
        doc.moveTo(x2, currentY).lineTo(x2, currentY + rowHeight).stroke();
        doc.moveTo(x3, currentY).lineTo(x3, currentY + rowHeight).stroke();
        doc.moveTo(x4, currentY).lineTo(x4, currentY + rowHeight).stroke();

        if (!isBlank) {
          const paddingY = currentY + 6; // paddingTop 6

          // --- Col 1: ลำดับ ---
          doc.font(fontNormal).fontSize(15).fillColor("black")
            .text(String(absIndex), x1, paddingY, { width: colWidths[0], align: "center" });

          // --- Col 2: ข้อมูล ---
          const infoX = x2 + 6; // paddingLeft 6
          let infoY = paddingY;

          // ชื่อ-นามสกุล (11pt Normal) - Frontend ไม่ได้ใส่ bold ตรงนี้ใน infoCell แต่ใส่ bold ตรง header
          // เช็คจาก frontend: { text: `${r.firstName...}` } <-- default style
          doc.font(fontNormal).fontSize(15).fillColor("black")
            .text(`${r.title} ${r.firstName} ${r.lastName}`, infoX, infoY);

          infoY += 20;
          // รหัส (Size 9, #666)
          doc.fontSize(15).fillColor("#666666")
            .text(`เลขที่นั่งสอบ ${r.userCode || "-"}`, infoX, infoY);

          infoY += 20;
          // ห้อง (Size 9, #666)
          doc.text(`ห้องสอบ ${r.roomName || "-"}`, infoX, infoY);
          infoY += 20;
          // ห้อง (Size 9, #666)
          doc.text(`แถวที่ ${r.row_no || "-"}`, infoX, infoY);

          infoY += 20; // margin 4 before signature
          // ลายเซ็น (Size 9, #666)
          doc.text("ลายเซ็น..................................................", infoX, infoY);

          // --- Col 3 & 4: QR Code ---
          // Frontend: image width 95, align center
          const qrSize = 95;
          const qrY = currentY + (rowHeight - qrSize) / 2; // Center vertically
          const qr1X = x3 + (colWidths[2] - qrSize) / 2; // Center horizontally
          const qr2X = x4 + (colWidths[3] - qrSize) / 2; // Center horizontally

          if (r.qr_payload) {
            try {
              // สร้าง Buffer (Backend ใช้ toBuffer)
              const qrBuffer = await QRCode.toBuffer(r.qr_payload, {
                width: 350, margin: 1, errorCorrectionLevel: 'M'
              });

              doc.image(qrBuffer, qr1X, qrY, { width: qrSize });
              doc.image(qrBuffer, qr2X, qrY, { width: qrSize });

            } catch (err) { console.error(err); }
          } else {
            // NULL Case
            // text: "NULL...", color: "#c00000", bold: true, fontSize: 9
            const nullY = currentY + (rowHeight / 2) - 4;
            doc.fillColor("#c00000").font(fontBold).fontSize(9);
            doc.text("NULL (ยังไม่เข้ารหัส)", x3, nullY, { width: colWidths[2], align: "center" });
            doc.text("NULL (ยังไม่เข้ารหัส)", x4, nullY, { width: colWidths[3], align: "center" });
          }
        } else {
          // Case Blank Row (ถ้าต้องการใส่ space เหมือน frontend)
          const paddingY = currentY + 6;
          // doc.text(" ", x1, paddingY);
        }

        currentY += rowHeight;
      }
    }

    doc.end();
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