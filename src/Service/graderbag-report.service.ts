import fs from "fs";
import path from "path";
import { Worker } from "worker_threads";
import graderBagReportRepo from "../Repo/graderbag-report.repo";
import { DB } from "../model/DB";
import { keyService } from "./key.service";

type BagScorePayloadRow = {
  random_num: string | number;
  qr_payload: string | null;
  score: string | number | null;
};

type BaseSheetInfo = {
  course?: string;
  org?: string;
  sessionText?: string;
  site?: string;
  start_num?: string;
  end_num?: string;
  grader_order?: number | null;
  question_no?: number;
  full_name?:string | null;
};

type BagPayloadPdfData = {
  bag_no: string | number;
  info: BaseSheetInfo;
  rows: BagScorePayloadRow[];
};

export class GraderBagReportService {
  private static async runWorkerTask(task: string, options: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const isTsNode = __filename.endsWith(".ts");
      const workerPath = path.resolve(
        __dirname,
        `./graderbag.worker${isTsNode ? ".ts" : ".js"}`
      );

      let worker: Worker;

      if (isTsNode) {
        worker = new Worker(
          `
            require('ts-node/register');
            require(require('worker_threads').workerData.__workerPath);
          `,
          {
            eval: true,
            workerData: { __workerPath: workerPath, task, options },
          }
        );
      } else {
        worker = new Worker(workerPath, {
          workerData: { task, options },
        });
      }

      worker.on("message", async (result: any) => {
        if (result.status === "success") {
          try {
            const pdfBuffer = await fs.promises.readFile(result.filePath);
            await fs.promises.unlink(result.filePath).catch(() => {});
            resolve(pdfBuffer);
          } catch (err) {
            reject(err);
          }
        } else {
          reject(new Error(result.message || "Worker failed"));
        }
      });

      worker.on("error", reject);
      worker.on("exit", (code) => {
        if (code !== 0) {
          reject(new Error(`Worker stopped with exit code ${code}`));
        }
      });
    });
  }

  static async generateBagScorePayloadPdf(bagId: number , questionNo: number , graderId: number): Promise<Buffer> {
    const conn = await DB.getInstance().getConnection();

    try {
      const header = await graderBagReportRepo.findBagReportHeader(conn, bagId);
      if (!header) {
        throw new Error("ไม่พบข้อมูลถุงที่ต้องการสร้างรายงาน");
      }
      const graderInfo = await graderBagReportRepo.findGraderInfoByBagId(conn, graderId);
      //console.log("Grader Info:", graderInfo , { bagId, questionNo, graderId });
      if (!graderInfo) {
        throw new Error("ไม่พบข้อมูลผู้ตรวจของถุงนี้");
      }

      const scoreRows = await graderBagReportRepo.findConfirmedScoresByBagId(conn, bagId, questionNo, graderId);
      if (!scoreRows.length) {
        throw new Error("ไม่พบคะแนนที่ยืนยันแล้วในถุงนี้");
      }

      const rows: BagScorePayloadRow[] = scoreRows.map((row) => ({
        random_num: row.random_num,
        qr_payload: row.qr_payload
          ? keyService.maskQrPayload(row.qr_payload)
          : null,
        score: row.score,
      }));

      const grader_order = scoreRows.map(row => row.grader_order);
      const allSameGraderOrder = grader_order.every(v => v === grader_order[0]);
        if (!allSameGraderOrder) {
            throw new Error("พบคะแนนจาก grader หลายคนในถุงนี้ ซึ่งไม่ควรเกิดขึ้น");
        }

      const bagData: BagPayloadPdfData = {
        bag_no: header.bag_no,
        info: {
          org: header.campaign_name ?? "-",
          course: header.subject_name ?? "-",
          site: header.site ?? "-",
          start_num: header.start_num ?? "-",
          end_num: header.end_num ?? "-",
          grader_order: grader_order[0] ?? null,
          question_no: questionNo,
          full_name: graderInfo.full_name ?? "-"
        },
        rows,
      };

      const pdfBuffer = await this.runWorkerTask("generateBagPayloadPdf", {
        bag: bagData,
      });

      return pdfBuffer;
    } 
    catch(error) {
      console.log("Service Error (GraderBagReportService.generateBagScorePayloadPdf):", error);
      throw error;
    }
    finally {
      conn.release();
    }
  }
}