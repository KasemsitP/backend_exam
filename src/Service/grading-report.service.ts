import { DB } from "../model/DB";
import {
  findQuestionCountForBagSubject,
  findQuestionAveragesForBagSubject,
  RawQuestionAverageRow,
  RawQuestionStatsRow,
  RawBookletQuestionStatsRow,
  findBookletQuestionStatsForBag,
  getUnlockCampaignByBagId
} from "../Repo/grading-report.repo";
export interface BagQuestionScoreRow {
  questionNo: number;
  label: string;
  category: string | null;
  grader1Score: number | null;
  grader1Name: string | null;
  grader2Score: number | null;
  grader2Name: string | null;
  finalScore: number | null;
}


export interface BagBookletQuestionBlock {
  bookletId: number;
  examCode: string;
  questionCount: number;
  questions: BagQuestionScoreRow[];

}

function buildBookletBlocks(
  raw: RawBookletQuestionStatsRow[],
  questionCount: number,
  unlock: number
): BagBookletQuestionBlock[] {
  const byBooklet = new Map<number, BagBookletQuestionBlock>();

  // 1) group ตาม booklet_id
  for (const r of raw) {
    let block = byBooklet.get(r.booklet_id);
    if (!block) {
      block = {
        bookletId: r.booklet_id,
        examCode: unlock === 1
          ? r.exam_code
          : String(r.booklet_id),
        questionCount: 0,
        questions: [],
      };
      byBooklet.set(r.booklet_id, block);
    }

    block.questions.push({
      questionNo: r.question_no,
      label: r.label ?? `ข้อ ${r.question_no}`,
      category: r.category ?? null,
      grader1Score: r.grader1_score != null ? Number(r.grader1_score) : null,
      grader1Name: r.grader1_names ?? null,
      grader2Score: r.grader2_score != null ? Number(r.grader2_score) : null,
      grader2Name: r.grader2_names ?? null,
      finalScore: r.final_score != null ? Number(r.final_score) : null,
    });
  }

  // 2) padding ให้ครบ 1..questionCount ทุกเล่ม
  for (const block of byBooklet.values()) {
    const map = new Map<number, BagQuestionScoreRow>();
    for (const q of block.questions) {
      map.set(q.questionNo, q);
    }

    const maxQ =
      questionCount && questionCount > 0
        ? questionCount
        : Array.from(map.keys()).reduce((m, q) => Math.max(m, q), 0);

    const filled: BagQuestionScoreRow[] = [];
    for (let q = 1; q <= maxQ; q++) {
      const s = map.get(q);
      filled.push(
        s ?? {
          questionNo: q,
          label: `ข้อ ${q}`,
          category: null,
          grader1Score: null,
          grader1Name: null,
          grader2Score: null,
          grader2Name: null,
          finalScore: null,
        }
      );
    }

    block.questionCount = maxQ;
    block.questions = filled;
  }

  // 3) sort ตาม bookletId เพื่อให้เรียงสวย ๆ
  return Array.from(byBooklet.values()).sort(
    (a, b) => a.bookletId - b.bookletId
  );
}

export function buildQuestionRows(
  stats: RawQuestionStatsRow[],
  questionCount: number
): BagQuestionScoreRow[] {
  const byQ = new Map<number, RawQuestionStatsRow>();
  for (const s of stats) {
    byQ.set(s.question_no, s);
  }

  // ถ้า questionCount = 0 ให้ใช้ max จาก stats
  const maxQ =
    questionCount && questionCount > 0
      ? questionCount
      : stats.reduce((mx, s) => Math.max(mx, s.question_no), 0);

  const rows: BagQuestionScoreRow[] = [];
  for (let q = 1; q <= maxQ; q++) {
    const s = byQ.get(q);
    rows.push({
      questionNo: q,
      label: s?.label ?? `ข้อ ${q}`,
      category: s?.category ?? null,
      grader1Score: s?.grader1_score ?? null,
      grader1Name: s?.grader1_names ?? null,
      grader2Score: s?.grader2_score ?? null,
      grader2Name: s?.grader2_names ?? null,
      finalScore: s?.final_score ?? null,
    });
  }
  return rows;
}

export interface BagScoresResponse {
  bagId: number;
  subjectId: number;
  questionCount: number;
  booklets: BagBookletQuestionBlock[];
}
export interface BagSubjectScoreRow {
  bookletId: number;
  examCode: string;
  perQuestion: Record<number, number | null>;
  totalScore: number;
}

export interface BagSubjectScoreResult {
  bagId: number;
  subjectId: number;
  questionCount: number;
  rows: BagSubjectScoreRow[];
}

export class GradingReportService {
  /**
   * ดึงคะแนนรายถุง รายวิชา แบบ dynamic ตามจำนวนข้อ
   * - 1 ข้อตรวจ 2 คน → เฉลี่ยด้วย AVG แล้ว
   */
  static async getScoresForBagSubject(
    bagId: number,
  ): Promise<BagSubjectScoreResult> {
    const conn = await DB.getInstance().getConnection();

    const subjectId = 0
    try {
      // 1) หา question_count ก่อน
      const questionCount =
        (await findQuestionCountForBagSubject(conn, bagId, subjectId)) ?? 0;

      // 2) ดึงข้อมูล row ดิบ (booklet_id, exam_code, question_no, avg_score)
      const rawRows: RawQuestionAverageRow[] =
        await findQuestionAveragesForBagSubject(conn, bagId, subjectId);

      // 3) รวมเป็น per-booklet แบบ dynamic
      const byBooklet = new Map<number, BagSubjectScoreRow>();

      for (const row of rawRows) {
        const bookletId = row.booklet_id;
        const questionNo = Number(row.question_no);
        const avgScore = Number(row.avg_score ?? 0);

        if (!byBooklet.has(bookletId)) {
          // เตรียม object เปล่าพร้อม perQuestion ทุกข้อเป็น null ก่อนก็ได้
          const perQuestion: Record<number, number | null> = {};
          for (let q = 1; q <= questionCount; q++) {
            perQuestion[q] = null;
          }

          byBooklet.set(bookletId, {
            bookletId,
            examCode: row.exam_code,
            perQuestion,
            totalScore: 0,
          });
        }

        const agg = byBooklet.get(bookletId)!;

        // ใส่คะแนนเฉลี่ยในข้อที่ตรงกัน
        agg.perQuestion[questionNo] = avgScore;
      }

      // 4) คำนวณ totalScore ให้แต่ละเล่ม
      const rows: BagSubjectScoreRow[] = Array.from(byBooklet.values()).map(
        (r) => {
          let sum = 0;
          for (let q = 1; q <= questionCount; q++) {
            const sc = r.perQuestion[q];
            if (sc != null) {
              sum += Number(sc);
            }
          }
          return {
            ...r,
            totalScore: sum,
          };
        }
      );

      return {
        bagId,
        subjectId,
        questionCount,
        rows,
      };
    } finally {
      conn.release();
    }
  }
  static async getBagScoresReport(
    bagId: number,
    subjectId: number = 0
  ): Promise<BagScoresResponse> {
    const conn = await DB.getInstance().getConnection();
    try {
      // 1) จำนวนข้อจาก session_subjects (เหมือนเดิม)
      const questionCount =
        (await findQuestionCountForBagSubject(conn, bagId, subjectId)) ?? 0;

      // 2) raw รายเล่ม-รายข้อ
      const rawPerBooklet = await findBookletQuestionStatsForBag(
        conn,
        bagId,
        subjectId
      );
      const result_is_unlock = await getUnlockCampaignByBagId(conn, bagId)


      console.log(result_is_unlock[0].campaign_id)

      const unlock = result_is_unlock[0].is_unlock

      const booklets = buildBookletBlocks(rawPerBooklet, questionCount, unlock);

      return {
        bagId,
        subjectId,
        questionCount,
        booklets,
      };
    } finally {
      conn.release();
    }
  }
}
