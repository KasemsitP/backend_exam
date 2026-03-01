import { Worker } from "worker_threads";
import path from "path";
import fs from "fs";
import { DB } from "../model/DB";
import {
  findQuestionCountForBagSubject,
  findQuestionAveragesForBagSubject,
  findBookletQuestionStatsForBag,
  getUnlockCampaignByBagId,
  findQuestionLabelForBagSubject,
  RawQuestionAverageRow,
} from "../Repo/grading-report.repo";

// =========================================================
// Interfaces
// =========================================================
export interface BagQuestionScoreRow {
  questionNo: number; label: string; category: string | null;
  grader1Score: number | null; grader1Name: string | null;
  grader2Score: number | null; grader2Name: string | null;
  finalScore: number | null;
}

export interface BagBookletQuestionBlock {
  bookletId: number; examCode: string; questionCount: number; questions: BagQuestionScoreRow[];
}

export interface BagScoresResponse {
  bagId: number; subjectId: number; questionCount: number;
  booklets: BagBookletQuestionBlock[]; questionLabels: { question_no: number; label: string }[];
}

export interface BagSubjectScoreRow {
  bookletId: number; examCode: string; perQuestion: Record<number, number | null>; totalScore: number;
}

export interface BagSubjectScoreResult {
  bagId: number; subjectId: number; questionCount: number; rows: BagSubjectScoreRow[];
}

export class GradingReportService {
  
  // -------------------------------------------------
  // ฟังก์ชันกลางสำหรับเรียก Worker
  // -------------------------------------------------
  private static async runWorkerTask(task: string, options: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const isTsNode = __filename.endsWith('.ts');
        const workerPath = path.resolve(__dirname, `./grading-report.worker${isTsNode ? '.ts' : '.js'}`);

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

  // =================================================
  // JSON Data API Methods (ให้ทำงานใน Main Thread)
  // =================================================
  static async getScoresForBagSubject(bagId: number): Promise<BagSubjectScoreResult> {
    const conn = await DB.getInstance().getConnection();
    const subjectId = 0;
    try {
      const questionCount = (await findQuestionCountForBagSubject(conn, bagId, subjectId)) ?? 0;
      const rawRows: RawQuestionAverageRow[] = await findQuestionAveragesForBagSubject(conn, bagId, subjectId);

      const byBooklet = new Map<number, BagSubjectScoreRow>();
      for (const row of rawRows) {
        const bookletId = row.booklet_id;
        const questionNo = Number(row.question_no);
        const avgScore = Number(row.avg_score ?? 0);

        if (!byBooklet.has(bookletId)) {
          const perQuestion: Record<number, number | null> = {};
          for (let q = 1; q <= questionCount; q++) perQuestion[q] = null;
          byBooklet.set(bookletId, { bookletId, examCode: row.exam_code, perQuestion, totalScore: 0 });
        }
        byBooklet.get(bookletId)!.perQuestion[questionNo] = avgScore;
      }

      const rows: BagSubjectScoreRow[] = Array.from(byBooklet.values()).map((r) => {
        let sum = 0;
        for (let q = 1; q <= questionCount; q++) {
          const sc = r.perQuestion[q];
          if (sc != null) sum += Number(sc);
        }
        return { ...r, totalScore: sum };
      });

      return { bagId, subjectId, questionCount, rows };
    } finally {
      conn.release();
    }
  }

  static async getBagScoresReport(bagId: number, subjectId: number = 0): Promise<BagScoresResponse> {
    const conn = await DB.getInstance().getConnection();
    try {
      const questionCount = (await findQuestionCountForBagSubject(conn, bagId, subjectId)) ?? 0;
      const questionLabels = await findQuestionLabelForBagSubject(conn, bagId, subjectId);
      const rawPerBooklet = await findBookletQuestionStatsForBag(conn, bagId, subjectId);
      const result_is_unlock = await getUnlockCampaignByBagId(conn, bagId);
      const unlock = result_is_unlock[0]?.is_unlock ?? 0;

      // Inline Helper (เหมือนใน worker)
      const byBooklet = new Map<number, any>();
      for (const r of rawPerBooklet) {
        let block = byBooklet.get(r.booklet_id);
        if (!block) {
          block = { bookletId: r.booklet_id, examCode: unlock === 1 ? r.exam_code : String(r.random_num), questionCount: 0, questions: [] };
          byBooklet.set(r.booklet_id, block);
        }
        block.questions.push({
          questionNo: r.question_no, label: r.label ?? `ข้อ ${r.question_no}`,
          category: r.category ?? null, grader1Score: r.grader1_score != null ? Number(r.grader1_score) : null,
          grader1Name: r.grader1_names ?? null, grader2Score: r.grader2_score != null ? Number(r.grader2_score) : null,
          grader2Name: r.grader2_names ?? null, finalScore: r.final_score != null ? Number(r.final_score) : null,
        });
      }
      for (const block of byBooklet.values()) {
        const map = new Map<number, any>();
        for (const q of block.questions) map.set(q.questionNo, q);
        const maxQ = questionCount && questionCount > 0 ? questionCount : Array.from(map.keys()).reduce((m, q) => Math.max(m, q), 0);
        const filled: any[] = [];
        for (let q = 1; q <= maxQ; q++) {
          filled.push(map.get(q) ?? { questionNo: q, label: `ข้อ ${q}`, category: null, grader1Score: null, grader1Name: null, grader2Score: null, grader2Name: null, finalScore: null });
        }
        block.questionCount = maxQ; block.questions = filled;
      }
      const booklets = Array.from(byBooklet.values()).sort((a, b) => a.bookletId - b.bookletId);

      return { bagId, subjectId, questionCount, booklets, questionLabels: questionLabels ?? [] };
    } finally {
      conn.release();
    }
  }

  // =================================================
  // PDF Generator Wrappers (ไปรันใน Worker)
  // =================================================

  static async generateBagScorePdf(bagId: number): Promise<Buffer> {
    return this.runWorkerTask('generateBagScorePdf', { bagId });
  }

  static async generateCampaignBagScoresPdf(campaignId: number): Promise<Buffer> {
    return this.runWorkerTask('generateCampaignBagScoresPdf', { campaignId });
  }

  static async generateGraderBagSummaryPdf(bagId: number, graderId: number, graderName: string): Promise<Buffer> {
    return this.runWorkerTask('generateGraderBagSummaryPdf', { bagId, graderId, graderName });
  }

  static async generatePassListPdf(opts: any): Promise<Buffer> {
    return this.runWorkerTask('generatePassListPdf', opts);
  }

  static async generateRankingPdf(opts: any): Promise<Buffer> {
    return this.runWorkerTask('generateRankingPdf', opts);
  }

  static async generateUnlockedBagScorePdfUser(opts: any): Promise<Buffer> {
    return this.runWorkerTask('generateUnlockedBagScorePdf', opts);
  }
}