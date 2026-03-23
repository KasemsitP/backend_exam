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


  private static sessionQrCache = new Map<number, { map: Map<string, string>, timestamp: number }>();
  private static CACHE_TTL = 30*1000; // 5 นาที  5 * 60 * 1000

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

    // 1. ดึงข้อมูลรายชื่อจาก Repo
    const result = await signSheetRepo.findUserSessionsWithPagination(
      session_id,
      campaign_id,
      page,
      limit,
      search
    );

    if (result.data.length === 0) return result;

    let connection;
    try {
      connection = await DB.getInstance().getConnection();

      // 🛑 2. เช็คว่าแคมเปญนี้ปลดล็อค (is_unlock = 1) หรือยัง?
      const [[campaign]] = await connection.query<any[]>(
        `SELECT is_unlock FROM exam_campaigns WHERE id = ?`,
        [campaign_id]
      );

      const isUnlocked = campaign?.is_unlock === 1;

      if (isUnlocked) {
        // ========================================================
        // 🚀 FAST PATH: ปลดล็อคแล้ว (ดึงจาก DB ตรงๆ เร็วสุดๆ)
        // ========================================================
        const userCodesInPage = result.data.map((r: any) => r.userCode); // เอาเฉพาะคนในหน้านี้ (เช่น 20 คน)

        if (userCodesInPage.length > 0) {
          const [booklets] = await connection.query<any[]>(
            `SELECT user_code, qr_payload FROM booklets WHERE session_id = ? AND user_code IN (?)`,
            [session_id, userCodesInPage]
          );

          // สร้าง Map จับคู่ user_code กับ qr_payload
          const fastQrMap = new Map(booklets.map(b => [b.user_code, b.qr_payload]));

          result.data = result.data.map((row: any) => ({
            ...row,
            qr_payload: fastQrMap.get(row.userCode) ? keyService.maskQrPayload(fastQrMap.get(row.userCode)) : null
          }));
        }

  } else {
        // ========================================================
        // 🐢 CACHE PATH: ยังเป็น Blind Mode (ต้องถอดรหัสผ่าน Worker)
        // ========================================================
        const now = Date.now();
        let cachedData = this.sessionQrCache.get(session_id);

        // ถ้าไม่มี Cache หรือ Cache หมดอายุ ให้ถอดรหัสใหม่ทั้งหมดผ่าน Worker
        if (!cachedData || (now - cachedData.timestamp > this.CACHE_TTL)) {
          const booklets = await bookletsRepo.findPayloadsBySessionId(connection, session_id);
          
          // 🚀 1. โยนงานถอดรหัสที่กิน CPU ไปให้ Worker ทำงานแทน!
          // ส่งอาเรย์ว่าง [] ไป เพื่อให้มันถอดรหัสทั้งก้อนเก็บไว้ใน Cache เลย
          const decryptedResults = await SignSheetService.runDecryptWorker(booklets, campaign_id, []);

          // 2. เอาผลลัพธ์จาก Worker มาสร้างเป็น Map
          const newQrMap = new Map<string, string>();
          decryptedResults.forEach((item: any) => {
            newQrMap.set(String(item.uid), item.qr_payload);
          });

          // 3. บันทึกลง Cache (จำไว้ใช้ 5 นาที)
          cachedData = { map: newQrMap, timestamp: now };
          this.sessionQrCache.set(session_id, cachedData);
        }

        // 4. ประกอบร่างข้อมูลด้วย Cache (เร็วปรื๊ด 0.01 วิ)
        const cachedQrMap = cachedData.map;
        result.data = result.data.map((row: any) => {
          //  เปลี่ยนเป็น userCode ให้ตรงกับไส้ใน QR
          const uidString = String(row.userCode);
          const rawQrPayload = cachedQrMap.get(uidString);

          return {
            ...row,
            qr_payload: rawQrPayload ? keyService.maskQrPayload(rawQrPayload) : null
          };
        });
      }

    } catch (err: any) {
      console.warn(`[SignSheetService] Warning: ${err.message}`);
      // ป้องกัน Error 500 ให้ส่งข้อมูลรายชื่อกลับไปหน้าเว็บตามปกติ (แค่ไม่มี QR)
      result.data = result.data.map((row: any) => ({ ...row, qr_payload: null }));
    } finally {
      if (connection) connection.release();
    }

    return result;
  }
static async runDecryptWorker(booklets: any[], campaign_id: number, targetUserCodes: string[]): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const isTsNode = __filename.endsWith('.ts');
    const workerPath = path.resolve(__dirname, `decrypt-worker${isTsNode ? '.ts' : '.js'}`);

    let worker: Worker;

    if (isTsNode) {
      // สำหรับ Environment Development (ts-node)
      worker = new Worker(`
        require('ts-node').register();
        const { workerData } = require('worker_threads');
        require(workerData.__workerPath);
      `, {
        eval: true,
        workerData: { __workerPath: workerPath, booklets, campaign_id, targetUserCodes }
      });
    } else {
      // สำหรับ Production (compiled js)
      worker = new Worker(workerPath, {
        workerData: { booklets, campaign_id, targetUserCodes }
      });
    }

    worker.on("message", (data) => resolve(data));
    worker.on("error", reject);
    worker.on("exit", (code) => {
      if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
    });
  });
}


}
