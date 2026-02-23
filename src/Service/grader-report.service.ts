import { Worker } from "worker_threads";
import path from "path";
import fs from "fs";

export class GraderReportService {

  // -------------------------------------------------
  // ฟังก์ชันกลางสำหรับเรียก Worker
  // -------------------------------------------------
  private static async runWorkerTask(task: string, options: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const isTsNode = __filename.endsWith('.ts');
        const workerPath = path.resolve(__dirname, `./grader-report.worker${isTsNode ? '.ts' : '.js'}`);

        let worker: Worker;
        if (isTsNode) {
            worker = new Worker(`
                require('ts-node/register');
                require(require('worker_threads').workerData.__workerPath);
            `, {
                eval: true,
                workerData: { __workerPath: workerPath, task, options }
            });
        } else {
            worker = new Worker(workerPath, { workerData: { task, options } });
        }

        worker.on("message", async (result: any) => {
            if (result.status === 'success') {
                try {
                    const pdfBuffer = await fs.promises.readFile(result.filePath);
                    await fs.promises.unlink(result.filePath).catch(() => {});
                    resolve(pdfBuffer);
                } catch (err) {
                    reject(err);
                }
            } else {
                reject(new Error(result.message));
            }
        });

        worker.on("error", reject);
        worker.on("exit", (code) => {
            if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
        });
    });
  }

  // ===========================================================================
  // 2. PDF GENERATION WRAPPERS (สั่งงาน Worker)
  // ===========================================================================

  static async generateBagGraderPdf(bagId: number): Promise<Buffer> {
    return this.runWorkerTask('generateBagGraderPdf', { bagId });
  }

  static async generateCampaignAllBagsGradersPdf(campaignId: number): Promise<Buffer> {
    return this.runWorkerTask('generateCampaignAllBagsGradersPdf', { campaignId });
  }
}