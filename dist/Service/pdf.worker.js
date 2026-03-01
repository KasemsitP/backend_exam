"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const worker_threads_1 = require("worker_threads");
const pdfkit_1 = __importDefault(require("pdfkit"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const qrcode_1 = __importDefault(require("qrcode"));
const signsheet_repo_1 = __importDefault(require("../Repo/signsheet.repo"));
const booklets_repo_1 = __importDefault(require("../Repo/booklets.repo"));
const DB_1 = require("../model/DB");
const key_service_1 = require("./key.service");
const chunk = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));
function runHeavyPdfTask() {
    return __awaiter(this, void 0, void 0, function* () {
        // ⏱️ 1. เริ่มจับเวลาภาพรวมของ Worker
        console.time("⏱️ [Worker] Total Task Time");
        console.log("🚀 [Worker] เริ่มต้นการทำงานสร้าง PDF (แบบตารางเดิม)...");
        // สร้าง Connection สำหรับดึง Booklets
        const connection = yield DB_1.DB.getInstance().getConnection();
        try {
            const { session_id, campaign_id, course, org, sessionText } = worker_threads_1.workerData;
            // ⏱️ 2. จับเวลาดึงข้อมูลจาก Database
            console.time("  ├─ 💾 DB Fetch & Mapping");
            // 2.1 ดึงข้อมูลผู้เข้าสอบ
            const list = yield signsheet_repo_1.default.findUserSessionByCampaignAndSession(session_id, campaign_id);
            // 2.2 ดึง QR จาก Booklets และถอดรหัสใน RAM
            // 2.2 ดึง QR จาก Booklets และถอดรหัสใน RAM
            const booklets = yield booklets_repo_1.default.findPayloadsBySessionId(connection, session_id);
            const mappedBooklets = yield Promise.all(booklets.map((b) => __awaiter(this, void 0, void 0, function* () {
                const decoded = yield key_service_1.keyService.decryptQrPayloadBags(b.qr_payload, campaign_id);
                // ตรวจสอบโครงสร้าง decoded เผื่อว่ามันซ้อนกัน
                const uid = (decoded === null || decoded === void 0 ? void 0 : decoded.uid) || (decoded === null || decoded === void 0 ? void 0 : decoded.user_id) || null;
                return { qr_payload: b.qr_payload, uid: uid };
            })));
            // 🛑 แก้จุดที่ 1: บังคับ Key ใน Map ให้เป็น String เสมอ
            const qrMap = new Map(mappedBooklets.map(mb => [String(mb.uid), mb.qr_payload]));
            // 🛑 เพิ่ม Log เช็คจำนวนว่าถอดรหัสออกมาได้กี่คน
            console.log(`  ├─ 🔍 ถอดรหัส QR ได้: ${mappedBooklets.length} รายการ (มีใน Map ${qrMap.size} keys)`);
            // 2.3 นำข้อมูลมา Map รวมกัน
            const rows = list.map((r) => {
                var _a;
                const uidString = String(r.user_id);
                const matchedPayload = qrMap.get(uidString) || null;
                // 🛑 เพิ่ม Log เช็คว่า User คนนี้หา QR เจอไหม (จะปรินต์ออกมาให้ดู)
                // ถ้าหาไม่เจอ มันจะขึ้นว่า false
                if (!matchedPayload) {
                    console.log(`  │  ⚠️ หา QR ไม่เจอสำหรับ User ID: ${uidString} (รหัส ${r.userCode})`);
                }
                return {
                    firstName: r.firstName,
                    lastName: r.lastName,
                    userCode: r.userCode,
                    roomName: (_a = r.roomName) !== null && _a !== void 0 ? _a : null,
                    qr_payload: matchedPayload ? key_service_1.keyService.maskQrPayload(matchedPayload) : null,
                    row_no: r.row_no,
                    title: r.title,
                    col_no: r.col_no
                };
            });
            console.timeEnd("  ├─ 💾 DB Fetch & Mapping");
            console.log(`  ├─ 👥 จำนวนผู้เข้าสอบทั้งหมด: ${rows.length} คน`);
            const doc = new pdfkit_1.default({
                size: "A4",
                margins: { top: 28, bottom: 28, left: 25, right: 25 },
                autoFirstPage: false,
                bufferPages: false, // ปิดไว้เพื่อเซฟ RAM
            });
            doc.registerFont("Sarabun", path_1.default.resolve(__dirname, "../../fonts/THSarabunNew.ttf"));
            doc.registerFont("SarabunBold", path_1.default.resolve(__dirname, "../../fonts/THSarabunNew-Bold.ttf"));
            // 2. สร้างไฟล์ชั่วคราว
            const fileName = `signsheet_${campaign_id}_${session_id}_${Date.now()}.pdf`;
            const filePath = path_1.default.join(os_1.default.tmpdir(), fileName);
            const writeStream = fs_1.default.createWriteStream(filePath);
            doc.pipe(writeStream);
            const ROWS_PER_PAGE = 6;
            const pages = chunk(rows, ROWS_PER_PAGE);
            const totalPages = Math.max(1, pages.length);
            if (pages.length === 0)
                pages.push([]);
            // ==========================================
            // Layout ตารางแบบเดิมของคุณ ไม่มีการแก้ไข
            // ==========================================
            const tableX = 25;
            const colWidths = [40, 545.28 - (40 + 120 + 120), 120, 120];
            const x1 = tableX;
            const x2 = x1 + colWidths[0];
            const x3 = x2 + colWidths[1];
            const x4 = x3 + colWidths[2];
            // ⏱️ 3. จับเวลาตอนวาดกระดาษ (ลูปหนักสุด)
            console.time("  ├─ ✍️  PDF Drawing Loop");
            // 3. เริ่มวาด PDF
            for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
                let pageRows = pages[pageIndex];
                const pageNo = pageIndex + 1;
                if (pageNo % 100 === 0 || pageNo === totalPages) {
                    console.log(`  │  ...กำลังวาดหน้า ${pageNo} / ${totalPages}`);
                }
                while (pageRows.length < ROWS_PER_PAGE) {
                    // @ts-ignore
                    pageRows.push({ title: "", firstName: "", lastName: "", userCode: "", roomName: null, row_no: null, qr_payload: null });
                }
                doc.addPage();
                // --- HEADER ---
                doc.font("SarabunBold").fontSize(16).text(`ใบเซ็นชื่อสอบวิชา ${course}`, { align: "center" });
                doc.moveDown(0.2);
                doc.font("Sarabun").text(`${sessionText} ณ ${org}`, { align: "center" });
                doc.moveDown(0.1);
                doc.fillColor("#666666").text(`${rows.length} คน | หน้า ${pageNo}/${totalPages}`, { align: "center" });
                doc.moveDown(0.5);
                // --- TABLE STRUCTURE ---
                const headerHeight = 20;
                const rowHeight = 110;
                const startY = doc.y;
                const tableBottomY = startY + headerHeight + (ROWS_PER_PAGE * rowHeight);
                doc.lineWidth(0.7).strokeColor("black").fillColor("black");
                doc.moveTo(x1, startY).lineTo(x1, tableBottomY).stroke();
                doc.moveTo(x2, startY).lineTo(x2, tableBottomY).stroke();
                doc.moveTo(x3, startY).lineTo(x3, tableBottomY).stroke();
                doc.moveTo(x4, startY).lineTo(x4, tableBottomY).stroke();
                doc.moveTo(x1 + 545.28, startY).lineTo(x1 + 545.28, tableBottomY).stroke();
                doc.moveTo(x1, startY).lineTo(x1 + 545.28, startY).stroke();
                doc.moveTo(x1, startY + headerHeight).lineTo(x1 + 545.28, startY + headerHeight).stroke();
                const textY = startY + 4;
                doc.font("SarabunBold").fontSize(11).fillColor("black");
                doc.text("ลำดับ", x1, textY, { width: colWidths[0], align: "center" });
                doc.text("ชื่อ-นามสกุล / รหัส / ห้อง", x2 + 6, textY, { width: colWidths[1], align: "left" });
                doc.text("คิวอาร์โค้ดภาคผนวก", x3, textY, { width: colWidths[2], align: "center" });
                doc.text("คิวอาร์โค้ดภาคผนวก", x4, textY, { width: colWidths[3], align: "center" });
                let currentY = startY + headerHeight;
                // --- วาดข้อมูลแต่ละแถว ---
                for (let i = 0; i < pageRows.length; i++) {
                    const r = pageRows[i];
                    const isBlank = !r.firstName && !r.userCode;
                    const absIndex = ((pageIndex) * ROWS_PER_PAGE) + i + 1;
                    doc.moveTo(x1, currentY + rowHeight).lineTo(x1 + 545.28, currentY + rowHeight).stroke();
                    if (!isBlank) {
                        const paddingY = currentY + 6;
                        const infoX = x2 + 6;
                        doc.font("Sarabun").fontSize(15).fillColor("black");
                        doc.text(String(absIndex), x1, paddingY, { width: colWidths[0], align: "center" });
                        let infoY = paddingY;
                        doc.text(`${r.title || ""} ${r.firstName || ""} ${r.lastName || ""}`.trim(), infoX, infoY);
                        infoY += 20;
                        doc.fillColor("black").text(`รหัสประจำตัวสอบ ${r.userCode || "-"}`, infoX, infoY);
                        infoY += 20;
                        doc.fillColor("black").text(`ห้องสอบ ${r.roomName || "-"}`, infoX, infoY);
                        infoY += 20;
                        doc.text(`แถวที่ ${r.row_no || "-"} ลำดับที่ ${r.col_no || "-"}`, infoX, infoY);
                        infoY += 20;
                        doc.text("ลายเซ็น..................................................", infoX, infoY);
                        const qrSize = 95;
                        const qrY = currentY + (rowHeight - qrSize) / 2;
                        const qr1X = x3 + (colWidths[2] - qrSize) / 2;
                        const qr2X = x4 + (colWidths[3] - qrSize) / 2;
                        // --- วาด QR CODE ---
                        if (r.qr_payload) {
                            try {
                                const qr = qrcode_1.default.create(r.qr_payload, { errorCorrectionLevel: 'M' });
                                const size = qr.modules.size;
                                const data = qr.modules.data;
                                const margin = 1;
                                const totalSize = size + (margin * 2);
                                const cellSize = qrSize / totalSize;
                                // โค้ดวาด QR อันเดิมของคุณที่ Optimize มาแล้ว
                                for (let row = 0; row < size; row++) {
                                    let startCol = -1;
                                    for (let col = 0; col < size; col++) {
                                        if (data[row * size + col]) {
                                            if (startCol === -1)
                                                startCol = col;
                                        }
                                        else {
                                            if (startCol !== -1) {
                                                const rectWidth = col - startCol;
                                                const cellY = qrY + (row + margin) * cellSize;
                                                doc.rect(qr1X + (startCol + margin) * cellSize, cellY, cellSize * rectWidth, cellSize);
                                                doc.rect(qr2X + (startCol + margin) * cellSize, cellY, cellSize * rectWidth, cellSize);
                                                startCol = -1;
                                            }
                                        }
                                    }
                                    if (startCol !== -1) {
                                        const rectWidth = size - startCol;
                                        const cellY = qrY + (row + margin) * cellSize;
                                        doc.rect(qr1X + (startCol + margin) * cellSize, cellY, cellSize * rectWidth, cellSize);
                                        doc.rect(qr2X + (startCol + margin) * cellSize, cellY, cellSize * rectWidth, cellSize);
                                    }
                                }
                                doc.fillColor('black').fill();
                            }
                            catch (e) {
                                console.error("QR Code Error:", e);
                            }
                        }
                        else {
                            const nullY = currentY + (rowHeight / 2) - 4;
                            doc.fillColor("#c00000").font("SarabunBold").fontSize(9);
                            doc.text("NULL (ยังไม่เข้ารหัส)", x3, nullY, { width: colWidths[2], align: "center" });
                            doc.text("NULL (ยังไม่เข้ารหัส)", x4, nullY, { width: colWidths[3], align: "center" });
                        }
                    }
                    currentY += rowHeight;
                }
                if (pageIndex % 50 === 0) {
                    yield new Promise(resolve => setTimeout(resolve, 0));
                }
            }
            console.timeEnd("  ├─ ✍️  PDF Drawing Loop");
            // ⏱️ 4. จับเวลาตอนเซฟไฟล์ลง Temp Disk
            console.time("  ├─ 📦 File Writing (Stream)");
            doc.end();
            writeStream.on('finish', () => {
                console.timeEnd("  ├─ 📦 File Writing (Stream)");
                console.timeEnd("⏱️ [Worker] Total Task Time");
                console.log("✅ [Worker] เขียนไฟล์เสร็จสิ้น ส่งงานกลับ Main Thread...");
                console.log("----------------------------------------");
                worker_threads_1.parentPort === null || worker_threads_1.parentPort === void 0 ? void 0 : worker_threads_1.parentPort.postMessage({ status: 'success', filePath: filePath });
            });
            writeStream.on('error', (err) => {
                throw err;
            });
        }
        catch (error) {
            console.timeEnd("⏱️ [Worker] Total Task Time");
            console.error("❌ Worker Error:", error);
            worker_threads_1.parentPort === null || worker_threads_1.parentPort === void 0 ? void 0 : worker_threads_1.parentPort.postMessage({ status: 'error', message: String(error) });
        }
        finally {
            connection.release(); // สำคัญ: อย่าลืมคืน Connection นะครับ
        }
    });
}
runHeavyPdfTask();
