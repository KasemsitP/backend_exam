import { Worker, parentPort, workerData } from "worker_threads";
import QRCode from "qrcode";
import path from "path";
import PDFDocument from "pdfkit";
import signSheetRepo from "../Repo/signsheet.repo";
import fs from "fs"; // เพิ่มบรรทัดนี้
import { DB } from "../model/DB";
import bookletsRepo from "../Repo/booklets.repo";
import { keyService } from "./key.service";


// --- Interface & Helper ---
type SignSheetRow = {
  firstName: string;
  lastName: string;
  userCode: string;
  roomName: string | null;
  row_no: number | null;
  col_no: number | null;
  title: string
  qr_payload: string | null;
  __absIndex?: number;
};

const chunk = <T>(arr: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );

export class SignSheetService {


  static async generatePdfInWorker(options: any): Promise<string> {
    return new Promise((resolve, reject) => {
      // 1. เรียกผู้ช่วยเชฟมาทำงาน (ชี้ไปที่ไฟล์ Worker)
      const workerPath = path.resolve(__dirname, 'pdf-worker.js');
      const worker = new Worker(workerPath, { workerData: options });

      // 2. รอผู้ช่วยเชฟส่งงานกลับมา
      worker.on("message", (result) => {
        resolve(result); // ได้ไฟล์ PDF มาแล้ว
      });

      // ดัก Error ถ้าผู้ช่วยทำพลาด
      worker.on("error", reject);
      worker.on("exit", (code) => {
        if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
      });
    });
  }
  static async generateSignSheetPdf(options: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {

      const isTsNode = __filename.endsWith('.ts');
      const workerPath = path.resolve(__dirname, `./pdf.worker${isTsNode ? '.ts' : '.js'}`);

      let worker: Worker;

      if (isTsNode) {
        worker = new Worker(`
          const { workerData } = require('worker_threads');
          require('ts-node').register();
          require(workerData.__workerPath);
        `, {
          eval: true,
          workerData: { __workerPath: workerPath, ...options }
        });
      } else {
        worker = new Worker(workerPath, { workerData: options });
      }

      // รับไฟล์กลับมาจาก Worker
      worker.on("message", async (result: any) => {
        if (result.status === 'success') {
          try {
            const pdfBuffer = await fs.promises.readFile(result.filePath);
            await fs.promises.unlink(result.filePath).catch(e => console.error("ลบ Temp ไม่สำเร็จ", e));
            resolve(pdfBuffer);
          } catch (err) {
            reject(err);
          }
        } else {
          reject(new Error(result.message));
        }
      });

      worker.on("error", (error) => reject(error));
      worker.on("exit", (code) => {
        if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
      });
    });
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
      qr_payload: r.qr_payload ? keyService.maskQrPayload(r.qr_payload) : null,
      row_no: r.row_no,
      title: r.title,
      col_no: r.col_no
    }));
  }

  static async getPaginatedUserSessions(options: {
    session_id: number;
    campaign_id: number;
    page: number;
    limit: number;
    search: string;
  }) {
    const { session_id, campaign_id, page, limit, search } = options;
    console.log("Fetching paginated user sessions with options:", options);

    // 1. ดึงข้อมูล User จาก Repo (ตอนนี้จะยังไม่มี qr_payload)
    const result = await signSheetRepo.findUserSessionsWithPagination(
      session_id,
      campaign_id,
      page,
      limit,
      search
    );

    // ถ้าไม่มีข้อมูลเลย ให้รีเทิร์นกลับไปเลยเพื่อประหยัดเวลา
    if (result.data.length === 0) {
      return result;
    }

    // เซ็ตค่า qr_payload ตั้งต้นให้เป็น null ทุกคนเผื่อไว้ก่อน
    result.data = result.data.map((row: any) => ({ ...row, qr_payload: null }));

    // 2. ดึง QR ของ Session นี้มาถอดรหัสเพื่อหาเจ้าของ
    let connection;
    try {
      connection = await DB.getInstance().getConnection();
      const booklets = await bookletsRepo.findPayloadsBySessionId(connection, session_id);

      if (booklets && booklets.length > 0) {
        const mappedBooklets = await Promise.all(
          booklets.map(async (b) => {
            try {
              const decoded = await keyService.decryptQrPayloadBags(b.qr_payload, campaign_id);
              const uid = decoded?.uid || decoded?.user_id || null;
              return { qr_payload: b.qr_payload, uid: uid };
            } catch (e) {
              // ถ้าถอดรหัสไม่ได้ (เช่น คีย์ผิด/ไม่มีคีย์) ก็ให้ข้าม QR ดวงนี้ไปเลย
              return { qr_payload: b.qr_payload, uid: null };
            }
          })
        );

        // สร้าง Map สำหรับค้นหา (ข้ามคนที่ uid เป็น null)
        const qrMap = new Map(
          mappedBooklets
            .filter(mb => mb.uid !== null)
            .map(mb => [String(mb.uid), mb.qr_payload])
        );

        result.data = result.data.map((row: any) => {
          const uidString = String(row.user_id);
          const rawQrPayload = qrMap.get(uidString); // ดึงค่าจริงจาก DB

          return {
            ...row,
            // 🛑 สวมหน้ากากตรงนี้เลย! (ถ้ามีค่า ค่อยเอาไป Mask)
            qr_payload: rawQrPayload ? keyService.maskQrPayload(rawQrPayload) : null
          };
        });
      }
    } catch (err: any) {
      // หาก Database Error หรือไม่มีคีย์หลัก จะตกลงมาที่นี่
      console.warn(` แจ้งเตือน: ข้ามการจับคู่ QR Code เนื่องจาก ${err.message}`);
      // ไม่ต้อง throw error ออกไป ปล่อยให้มันไหลไป return result ที่มีแค่รายชื่อ
    } finally {
      if (connection) connection.release(); // คืน connection อย่างปลอดภัย
    }
    return result;
  }



}
