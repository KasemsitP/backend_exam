import { Worker } from "worker_threads";
import path from "path";
import fs from "fs";

export class SeatPlanService {
    
    // ฟังก์ชันกลางสำหรับเรียก Worker
    private static async runWorkerTask(task: string, options: any): Promise<Buffer | null> {
        return new Promise((resolve, reject) => {
            const isTsNode = __filename.endsWith('.ts');
            const workerPath = path.resolve(__dirname, `./seatplan.worker${isTsNode ? '.ts' : '.js'}`);

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

            // รอรับผลลัพธ์
            worker.on("message", async (result: any) => {
                if (result.status === 'success') {
                    // กรณีที่ข้อมูลว่างเปล่า (เช่น info === null)
                    if (!result.filePath) return resolve(null); 

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

    // -------------------------------------------------
    // เรียกใช้ฟังก์ชันเดิมของคุณ โดยชี้ไปหา Worker แทน
    // -------------------------------------------------
    static async generateSeatPlanPdf(options: {
        session_id: number;
        campaign_id: number;
        title?: string;
    }): Promise<Buffer> {
        return this.runWorkerTask('generateSeatPlanPdf', options) as Promise<Buffer>;
    }

    static async generateSeatPlanNameListPdf(options: {
        campaign_id: number;
    }): Promise<Buffer | null> {
        return this.runWorkerTask('generateSeatPlanNameListPdf', options);
    }
}