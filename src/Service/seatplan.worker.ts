import { parentPort, workerData } from "worker_threads";
import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import os from "os";
import seatPlanRepo, { SeatPlanRow, SeatPlanNameRow } from "../Repo/seatplan.repo";

// ---------------------------------------------------------
// Task 1: สร้างผังที่นั่งสอบ
// ---------------------------------------------------------
async function buildSeatPlanPdf(options: any, writeStream: fs.WriteStream) {
    const { session_id, campaign_id } = options;
    const title = options.title ?? "ผังที่นั่งสอบ";

    const info = await seatPlanRepo.getExamInfoWithSessions(campaign_id);
    if (!info) throw new Error("ไม่พบข้อมูลรอบสอบ");

    const rows: SeatPlanRow[] = await seatPlanRepo.findSeatPlanByCampaignAndSession(session_id, campaign_id);

    const doc = new PDFDocument({
        size: "A4",
        margins: { top: 40, bottom: 40, left: 40, right: 40 },
        autoFirstPage: true,
        bufferPages: false, // 🚀 สำคัญ: ปิดเพื่อไม่ให้ RAM เต็ม
    });

    const fontNormal = path.resolve(__dirname, "../../fonts/THSarabunNew.ttf");
    const fontBold = path.resolve(__dirname, "../../fonts/THSarabunNew-Bold.ttf");

    doc.pipe(writeStream);

    // ===== Header =====
    doc.font(fontBold).fontSize(16).text(title, { align: "center" });
    doc.moveDown(0.3);
    doc.font(fontNormal).fontSize(14).text(`${info.exam.name}`, { align: "center" });
    doc.moveDown(0.3);
    doc.font(fontNormal).fontSize(14).text(`${info.exam.site}`, { align: "center" });
    doc.moveDown(0.3);

    const pageWidth = doc.page.width;
    const tableWidth = pageWidth - doc.page.margins.left - doc.page.margins.right;
    const colWidth = tableWidth / 3;
    const startX = doc.page.margins.left;
    let y = doc.y + 10;
    const rowHeight = 22;

    const x1 = startX;
    const x2 = x1 + colWidth;
    const x3 = x2 + colWidth;

    doc.lineWidth(0.7).strokeColor("black");

    // ===== Header row =====
    // ⚡ รวบคำสั่งวาดเส้น แล้วสั่ง stroke ครั้งเดียว
    doc.rect(startX, y, tableWidth, rowHeight)
       .moveTo(x2, y).lineTo(x2, y + rowHeight)
       .moveTo(x3, y).lineTo(x3, y + rowHeight)
       .stroke();

    doc.font(fontBold).fontSize(12);
    const headerY = y + 4;
    doc.text("เลขประจำตัวที่สอบ", x1, headerY, { width: colWidth, align: "center" });
    doc.text("ห้องสอบ", x2, headerY, { width: colWidth, align: "center" });
    doc.text("แถว", x3, headerY, { width: colWidth, align: "center" });

    y += rowHeight;
    doc.font(fontNormal).fontSize(12);

    // ===== Data rows =====
    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        
        if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
            doc.addPage();
            y = doc.page.margins.top;

            doc.rect(startX, y, tableWidth, rowHeight)
               .moveTo(x2, y).lineTo(x2, y + rowHeight)
               .moveTo(x3, y).lineTo(x3, y + rowHeight)
               .stroke();

            const hY = y + 4;
            doc.font(fontBold).fontSize(12);
            doc.text("เลขประจำตัวที่สอบ", x1, hY, { width: colWidth, align: "center" });
            doc.text("ห้องสอบ", x2, hY, { width: colWidth, align: "center" });
            doc.text("แถว", x3, hY, { width: colWidth, align: "center" });

            doc.font(fontNormal).fontSize(12);
            y += rowHeight;
        }

        // ⚡ รวบการวาดเส้นของแถวข้อมูล (ประหยัดคำสั่งลง 3 เท่า)
        doc.rect(startX, y, tableWidth, rowHeight)
           .moveTo(x2, y).lineTo(x2, y + rowHeight)
           .moveTo(x3, y).lineTo(x3, y + rowHeight)
           .stroke();

        const cellY = y + 4;
        doc.text(r.rangeLabel, x1, cellY, { width: colWidth, align: "center" });
        doc.text(r.roomName ?? "-", x2, cellY, { width: colWidth, align: "center" });
        doc.text(String(r.rowNo), x3, cellY, { width: colWidth, align: "center" });

        y += rowHeight;

        // ให้ Event loop หายใจ
        if (i % 200 === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }

    doc.end();
}

// ---------------------------------------------------------
// Task 2: สร้างรายชื่อผู้มีสิทธิ์เข้าศึกษา (Name List)
// ---------------------------------------------------------
async function buildNameListPdf(options: any, writeStream: fs.WriteStream) {
    const { campaign_id } = options;

    const info = await seatPlanRepo.getExamInfoWithSessions(campaign_id);
    if (!info) {
        parentPort?.postMessage({ status: 'success', filePath: null });
        return;
    }

    const days = info.dates.map(d => d.getUTCDate()).sort((a, b) => a - b);
    let daysText = "";
    if (days.length === 1) daysText = `${days[0]}`;
    else if (days.length === 2) daysText = `${days[0]} และ ${days[1]}`;
    else daysText = days.slice(0, -1).join(", ") + " และ " + days[days.length - 1];

    const rows: SeatPlanNameRow[] = await seatPlanRepo.findSeatPlanNameListByCampaign(campaign_id);

    const doc = new PDFDocument({
        size: "A4",
        margins: { top: 40, bottom: 40, left: 40, right: 40 },
        autoFirstPage: true,
        bufferPages: false, // 🚀 ป้องกัน RAM บวม
    });

    const fontNormal = path.resolve(__dirname, "../../fonts/THSarabunNew.ttf");
    const fontBold = path.resolve(__dirname, "../../fonts/THSarabunNew-Bold.ttf");

    doc.pipe(writeStream);

    /* -------- Header -------- */
    doc.font(fontNormal).fontSize(14).text("รายชื่อผู้มีสิทธิ์เข้าศึกษาพร้อมที่นั่งสอบและสถานที่สอบ", { align: "center" });
    doc.moveDown(0.2);
    doc.font(fontNormal).fontSize(12).text("ในการสอบคัดเลือกเพื่อบรรจุเป็นข้าราชการอัยการและแต่งตั้งให้ดำรงตำแหน่ง", { align: "center" });
    doc.moveDown(0.2);
    doc.font(fontNormal).fontSize(12).text(`อัยการผู้ช่วย พ.ศ.${info.exam.year_be} (${info.exam.campaign_size})`, { align: "center" });
    doc.moveDown(0.3);
    doc.text(`วันที่ ${daysText}`, { align: "center" });
    doc.moveDown(0.5);
    doc.text(`ณ ${info.exam.site}`, { align: "center" });
    doc.moveDown(0.5);
    doc.text(`รายชื่อผู้มีสิทธิ์เข้าศึกษาพร้อมแผนผังที่นั่งสอบ จำนวน ${rows.length} คน เรียงตามตัวอักษร`, { align: "center" });
    doc.moveDown(1);

    const pageWidth = doc.page.width;
    const { left, right, bottom } = doc.page.margins;
    const tableWidth = pageWidth - left - right;

    const col1_W = tableWidth * 0.08; 
    const col2_W = tableWidth * 0.38; 
    const col3_W = tableWidth * 0.18; 
    const col4_W = tableWidth * 0.16; 
    const col5_W = tableWidth * 0.10; 
    const col6_W = tableWidth - (col1_W + col2_W + col3_W + col4_W + col5_W); 

    const startX = left;
    let y = doc.y + 5;
    const headerHeight = 18;
    const rowHeight = 18;

    const x1 = startX;
    const x2 = x1 + col1_W;
    const x3 = x2 + col2_W;
    const x4 = x3 + col3_W;
    const x5 = x4 + col4_W;
    const x6 = x5 + col5_W;

    const drawHeaderRow = () => {
        doc.lineWidth(0.7).strokeColor("black");
        
        // ⚡ รวบคำสั่งวาดเส้นตาราง (1 กรอบ + 5 เส้นแนวตั้ง) แล้ว stroke ทีเดียว
        doc.rect(startX, y, tableWidth, headerHeight)
           .moveTo(x2, y).lineTo(x2, y + headerHeight)
           .moveTo(x3, y).lineTo(x3, y + headerHeight)
           .moveTo(x4, y).lineTo(x4, y + headerHeight)
           .moveTo(x5, y).lineTo(x5, y + headerHeight)
           .moveTo(x6, y).lineTo(x6, y + headerHeight)
           .stroke(); 

        const hY = y + 3;
        doc.font(fontBold).fontSize(11);
        doc.text("ลำดับ", x1, hY, { width: col1_W, align: "center" });
        doc.text("ชื่อ - สกุล", x2, hY, { width: col2_W, align: "center" });
        doc.text("เลขประจำตัวสอบ", x3, hY, { width: col3_W, align: "center" });
        doc.text("ห้องสอบ", x4, hY, { width: col4_W, align: "center" });
        doc.text("แถว", x5, hY, { width: col5_W, align: "center" });
        doc.text("ลำดับในแถว", x6, hY, { width: col6_W, align: "center" }); 

        y += headerHeight;
        doc.font(fontNormal).fontSize(11);
    };

    drawHeaderRow();

    // เปลี่ยนจาก forEach เป็น for...let เพื่อให้ใช้ await ได้
    for (let index = 0; index < rows.length; index++) {
        const r = rows[index];
        const fullname = `${r.title} ${r.fullName}`;
        
        if (y + rowHeight > doc.page.height - bottom) {
            doc.addPage();
            y = doc.page.margins.top;
            drawHeaderRow();
        }

        // ⚡ รวบคำสั่งวาดเส้นแถวข้อมูล (ประหยัดคำสั่งลง 6 เท่า)
        doc.rect(startX, y, tableWidth, rowHeight)
           .moveTo(x2, y).lineTo(x2, y + rowHeight)
           .moveTo(x3, y).lineTo(x3, y + rowHeight)
           .moveTo(x4, y).lineTo(x4, y + rowHeight)
           .moveTo(x5, y).lineTo(x5, y + rowHeight)
           .moveTo(x6, y).lineTo(x6, y + rowHeight)
           .stroke(); 

        const cellY = y + 3;
        doc.text(String(index + 1), x1, cellY, { width: col1_W, align: "center" });
        doc.text(fullname, x2 + 4, cellY, { width: col2_W - 8, align: "left" });
        doc.text(r.userCode, x3, cellY, { width: col3_W, align: "center" });
        doc.text(r.roomName ?? "-", x4, cellY, { width: col4_W, align: "center" });
        doc.text(String(r.rowNo), x5, cellY, { width: col5_W, align: "center" });
        doc.text(String(r.colNo ?? "-"), x6, cellY, { width: col6_W, align: "center" }); 

        y += rowHeight;

        // ให้ Event loop หายใจ
        if (index % 200 === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }

    doc.end();
}

// ---------------------------------------------------------
// ผู้ควบคุมงาน (Main Worker Logic)
// ---------------------------------------------------------
async function runTask() {
    try {
        const { task, options } = workerData;

        // สร้างไฟล์ Temp
        const fileName = `seatplan_${Date.now()}_${Math.floor(Math.random() * 1000)}.pdf`;
        const filePath = path.join(os.tmpdir(), fileName);
        const writeStream = fs.createWriteStream(filePath);

        // เลือกทำงานตามที่ Service หลักสั่งมา
        if (task === 'generateSeatPlanPdf') {
            await buildSeatPlanPdf(options, writeStream);
        } else if (task === 'generateSeatPlanNameListPdf') {
            await buildNameListPdf(options, writeStream);
        }

        // เมื่อไฟล์เขียนเสร็จ ส่งชื่อไฟล์กลับ
        writeStream.on('finish', () => {
            parentPort?.postMessage({ status: 'success', filePath });
        });
        writeStream.on('error', (err) => { throw err; });

    } catch (error) {
        parentPort?.postMessage({ status: 'error', message: String(error) });
    }
}

runTask();