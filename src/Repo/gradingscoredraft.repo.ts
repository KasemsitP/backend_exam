import { DB } from "../model/DB";
import { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { GradingSlotRow } from "./gradingslot.repo";

export type DraftStatus = "DRAFT" | "CONFIRMED" | "CANCELLED";

export interface DbGradingScoreDraftRow extends RowDataPacket {
    id: number;
    bag_id: number;
    booklet_id: number;
    subject_id: number;
    question_no: number;
    slot_id: number;
    grader_id: number;
    score: number;
    status: DraftStatus;
    created_at: Date;
    updated_at: Date;
    bag_no: number;
}

export interface DraftContextRow extends RowDataPacket {
    slotId: number;
    bookletId: number;
    subjectId: number;
    questionNo: number;
    graderId: number;
    bagId: number | null;
}

export interface DraftQuestionInfoRow extends RowDataPacket {
    slot_id: number;
    booklet_id: number;
    subject_id: number;
    question_no: number;
    question_label: string;
    max_score: number;
}
export interface getScoreDraftForGrader extends RowDataPacket {
    id: number;
    bag_id: number;
    booklet_id: number;
    subject_id: number;
    question_no: number;
    slot_id: number;
    grader_id: number;
    score: number;
    status: DraftStatus;
    created_at: Date;
    updated_at: Date;
    bag_no: number;
    status_slot: string;
    payload : string;
    random_num : string;
    subject_name : string;
    question_label : string;
    subject_label : string;

}

class GradingScoreDraftRepo {
    private pool: Pool;

    constructor() {
        // @ts-ignore
        this.pool = DB.getInstance() as unknown as Pool;
    }

    async verifySlotContext(
        conn: PoolConnection,
        params: {
            slotId: number;
            campaignId: number;
            graderId: number;
        }
    ): Promise<boolean> {
        const { slotId, campaignId, graderId } = params;

        const sql = `
      SELECT
        s.id AS slot_id
      FROM grading_slots s
      JOIN booklets b
        ON s.booklet_id = b.id
      JOIN sessions sess
        ON b.session_id = sess.id
      WHERE s.id = ?
        AND sess.campaign_id = ?
        AND s.grader_id = ?
      LIMIT 1
    `;

        const [rows] = await conn.execute<RowDataPacket[]>(sql, [
            slotId,
            campaignId,
            graderId,
        ]);

        return rows.length > 0;
    }

    async findDraftContextBySlotId(
        conn: PoolConnection,
        slotId: number
    ): Promise<DraftContextRow | null> {
        const sql = `
      SELECT
        gs.id AS slotId,
        gs.booklet_id AS bookletId,
        gs.subject_id AS subjectId,
        gs.question_no AS questionNo,
        gs.grader_id AS graderId,
        b.bag_id AS bagId
      FROM grading_slots gs
      JOIN booklets b
        ON b.id = gs.booklet_id
      WHERE gs.id = ?
      LIMIT 1
    `;

        const [rows] = await conn.query<DraftContextRow[]>(sql, [slotId]);
        return rows[0] || null;
    }

    async checkScoreInfo(
        conn: PoolConnection,
        params: {
            slotId: number;
            graderId: number;
            questionNo: number;
        }
    ): Promise<DraftQuestionInfoRow | null> {
        const { slotId, graderId, questionNo } = params;

        const sql = `
      SELECT
        gs.id AS slot_id,
        gs.booklet_id,
        gs.subject_id,
        gs.question_no,
        sq.label AS question_label,
        sq.max_score
      FROM grading_slots gs
      JOIN subject_questions sq
        ON sq.subject_id = gs.subject_id
       AND sq.question_no = gs.question_no
      WHERE gs.id = ?
        AND gs.grader_id = ?
        AND gs.question_no = ?
      LIMIT 1
    `;

        const [rows] = await conn.query<DraftQuestionInfoRow[]>(sql, [
            slotId,
            graderId,
            questionNo,
        ]);

        return rows[0] || null;
    }

    async findDraftBySlotId(
        conn: PoolConnection,
        slotId: number
    ): Promise<DbGradingScoreDraftRow | null> {
        const sql = `
      SELECT
        id,
        bag_id,
        booklet_id,
        subject_id,
        question_no,
        slot_id,
        grader_id,
        score,
        status,
        created_at,
        updated_at
      FROM grading_score_drafts
      WHERE slot_id = ?
      LIMIT 1
    `;

        const [rows] = await conn.query<DbGradingScoreDraftRow[]>(sql, [slotId]);
        return rows[0] || null;
    }

    async insertDraft(
        conn: PoolConnection,
        params: {
            bagId: number;
            bookletId: number;
            subjectId: number;
            questionNo: number;
            slotId: number;
            graderId: number;
            score: number;
        }
    ): Promise<number> {
        const sql = `
      INSERT INTO grading_score_drafts (
        bag_id,
        booklet_id,
        subject_id,
        question_no,
        slot_id,
        grader_id,
        score,
        status,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'DRAFT', CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+07:00'), CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+07:00'))
    `;

        const [result] = await conn.execute<ResultSetHeader>(sql, [
            params.bagId,
            params.bookletId,
            params.subjectId,
            params.questionNo,
            params.slotId,
            params.graderId,
            params.score,
        ]);

        return result.insertId;
    }

    async updateDraftScoreBySlotId(
        conn: PoolConnection,
        slotId: number,
        score: number
    ): Promise<void> {
        const sql = `
      UPDATE grading_score_drafts
      SET
        score = ?,
        status = 'DRAFT',
        updated_at = CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+07:00')
      WHERE slot_id = ?
    `;

        await conn.execute(sql, [score, slotId]);
    }

    async upsertDraft(
        conn: PoolConnection,
        params: {
            bagId: number;
            bookletId: number;
            subjectId: number;
            questionNo: number;
            slotId: number;
            graderId: number;
            score: number;
        }
    ): Promise<void> {
        const existing = await this.findDraftBySlotId(conn, params.slotId);

        if (!existing) {
            await this.insertDraft(conn, params);
            return;
        }

        await this.updateDraftScoreBySlotId(conn, params.slotId, params.score);
    }

    async findDraftsByBagId(
        conn: PoolConnection,
        bagId: number,
        status: DraftStatus = "DRAFT"
    ): Promise<DbGradingScoreDraftRow[]> {
        const sql = `
      SELECT
        gs.id,
        gs.bag_id,
        gs.booklet_id,
        gs.subject_id,
        gs.question_no,
        gs.slot_id,
        gs.grader_id,
        gs.score,
        gs.status,
        gs.created_at,
        gs.updated_at,
        b.bag_no
      FROM grading_score_drafts gs
      JOIN bags b ON b.id = gs.bag_id
      WHERE gs.bag_id = ?
        AND gs.status = ?
      ORDER BY gs.booklet_id, gs.subject_id, gs.question_no, gs.slot_id
    `;

        const [rows] = await conn.query<DbGradingScoreDraftRow[]>(sql, [
            bagId,
            status,
        ]);

        return rows;
    }

    async countDraftsByBagId(
        conn: PoolConnection,
        bagId: number,
        status: DraftStatus = "DRAFT"
    ): Promise<number> {
        const sql = `
      SELECT COUNT(*) AS total
      FROM grading_score_drafts
      WHERE bag_id = ?
        AND status = ?
    `;

        const [rows] = await conn.query<RowDataPacket[]>(sql, [bagId, status]);
        return Number(rows[0]?.total ?? 0);
    }

    async cancelDraftBySlotId(
        conn: PoolConnection,
        slotId: number
    ): Promise<void> {
        const sql = `
      UPDATE grading_score_drafts
      SET
        status = 'CANCELLED',
        updated_at = CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+07:00')
      WHERE slot_id = ?
        AND status = 'DRAFT'
    `;

        await conn.execute(sql, [slotId]);
    }

    async markDraftsConfirmedByBagId(
        conn: PoolConnection,
        bagId: number
    ): Promise<void> {
        const sql = `
      UPDATE grading_score_drafts
      SET
        status = 'CONFIRMED',
        updated_at = CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+07:00')
      WHERE bag_id = ?
        AND status = 'DRAFT'
    `;

        await conn.execute(sql, [bagId]);
    }

    async getDraftQuestionInfoBySlotId(
        conn: PoolConnection,
        slotId: number
    ): Promise<DraftQuestionInfoRow | null> {
        const sql = `
      SELECT
        gs.id AS slot_id,
        gs.booklet_id,
        gs.subject_id,
        gs.question_no,
        sq.label AS question_label,
        sq.max_score
      FROM grading_slots gs
      JOIN subject_questions sq
        ON sq.subject_id = gs.subject_id
       AND sq.question_no = gs.question_no
      WHERE gs.id = ?
      LIMIT 1
    `;

        const [rows] = await conn.query<DraftQuestionInfoRow[]>(sql, [slotId]);
        return rows[0] || null;
    }
    async findUnscoredSlotForGrader(
        conn: PoolConnection,
        bookletId: number,
        subjectId: number,
        questionNo: number,
        graderId: number
    ): Promise<GradingSlotRow | null> {
        const sql = `
SELECT s.*
FROM grading_slots s
LEFT JOIN grading_score_drafts gs
  ON gs.slot_id = s.id
WHERE s.booklet_id = ?
  AND s.subject_id = ?
  AND s.question_no = ?
  AND s.grader_id  = ?
  AND gs.id IS NULL
LIMIT 1
FOR UPDATE;
    `;
        const [rows] = await conn.execute<GradingSlotRow[]>(sql, [
            bookletId,
            subjectId,
            questionNo,
            graderId,
        ]);
        return rows[0] ?? null;
    }
async findActiveBagByGraderId(
  conn: PoolConnection,
  graderId: number
): Promise<{ bag_id: number; bag_no: number } | null> {
  const sql = `
    SELECT
      b.id AS bag_id,
      b.bag_no
    FROM bags b
    WHERE b.id = (
      SELECT x.bag_id
      FROM (
        SELECT gsd.bag_id
        FROM grading_score_drafts gsd
        WHERE gsd.grader_id = ?
          AND gsd.status = 'DRAFT'
        GROUP BY gsd.bag_id
        ORDER BY MAX(gsd.updated_at) DESC
        LIMIT 1
      ) x
    )
    LIMIT 1
  `;

  const [rows] = await conn.query<RowDataPacket[]>(sql, [graderId]);
  if (!rows.length) return null;

  return {
    bag_id: Number(rows[0].bag_id),
    bag_no: Number(rows[0].bag_no),
  };
}

    async getAllDraftsUnConfirmed(
        conn: PoolConnection,
        graderId: number,
        status: DraftStatus = "DRAFT"
    ): Promise<getScoreDraftForGrader[]> {
        const sql = `
SELECT
  b.id AS bag_id,
  b.bag_no,

  bk.id AS booklet_id,
  bk.random_num,
  bk.qr_payload AS payload,

  gs.id AS slot_id,
  gs.subject_id,
  gs.question_no,
  gs.grader_id,
  gs.grader_order,
  gs.status AS slot_status,

  gsd.id AS draft_id,
  gsd.score,
  gsd.status AS draft_status,
  gsd.created_at,
  gsd.updated_at,

  CASE
    WHEN gs.id IS NULL THEN 'ยังไม่มี slot'
    WHEN gsd.id IS NULL THEN 'มี slot แต่ยังไม่ตรวจ'
    ELSE 'ตรวจแล้ว'
  END AS progress_status

FROM bags b
JOIN booklets bk
  ON bk.bag_id = b.id

LEFT JOIN grading_slots gs
  ON gs.booklet_id = bk.id
 AND gs.grader_id = ?

LEFT JOIN grading_score_drafts gsd
  ON gsd.slot_id = gs.id
 AND gsd.status = 'DRAFT'

WHERE b.id = (
  SELECT x.bag_id
  FROM (
    SELECT gsd2.bag_id
    FROM grading_score_drafts gsd2
    WHERE gsd2.grader_id = ?
      AND gsd2.status = 'DRAFT'
    GROUP BY gsd2.bag_id
    ORDER BY MAX(gsd2.updated_at) DESC
    LIMIT 1
  ) x
)

ORDER BY bk.random_num, gs.subject_id, gs.question_no, gs.id;
    `;

        const [rows] = await conn.query<getScoreDraftForGrader[]>(sql, [
            graderId,graderId
        ]);

        return rows;
    }
    async validateSlotsForConfirm(
  conn: PoolConnection,
  bagId: number,
  graderId: number,
  slotIds: number[]
): Promise<boolean> {
  if (!slotIds.length) return false;

  const placeholders = slotIds.map(() => "?").join(",");

  const sql = `
    SELECT COUNT(*) AS total
    FROM grading_slots gs
    JOIN booklets bk
      ON bk.id = gs.booklet_id
    WHERE gs.id IN (${placeholders})
      AND gs.grader_id = ?
      AND bk.bag_id = ?
  `;

  const [rows] = await conn.query<RowDataPacket[]>(sql, [
    ...slotIds,
    graderId,
    bagId,
  ]);

  return Number(rows[0]?.total ?? 0) === slotIds.length;
}
async markDraftsConfirmedByBagIdAndGraderId(
  conn: PoolConnection,
  bagId: number,
  graderId: number
): Promise<void> {
  const sql = `
    UPDATE grading_score_drafts
    SET
      status = 'CONFIRMED',
      updated_at = CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+07:00')
    WHERE bag_id = ?
      AND grader_id = ?
      AND status = 'DRAFT'
  `;

  await conn.query(sql, [bagId, graderId]);
}
async getAllDraftsUnConfirmedByBagId(
  conn: PoolConnection,
  bagId: number,
  graderId: number
): Promise<getScoreDraftForGrader[]> {
  const sql = `
    SELECT
      b.id AS bag_id,
      b.bag_no,

      bk.id AS booklet_id,
      bk.random_num,
      bk.qr_payload AS payload,

      gs.id AS slot_id,
      gs.subject_id,
      gs.question_no,
      gs.grader_id,
      gs.grader_order,
      gs.status AS slot_status,

      gsd.id AS draft_id,
      gsd.score,
      gsd.status AS draft_status,
      gsd.created_at,
      gsd.updated_at,

      CASE
        WHEN gs.id IS NULL THEN 'ยังไม่มี slot'
        WHEN gsd.id IS NULL THEN 'มี slot แต่ยังไม่ตรวจ'
        ELSE 'ตรวจแล้ว'
      END AS progress_status

    FROM bags b
    JOIN booklets bk
      ON bk.bag_id = b.id

    LEFT JOIN grading_slots gs
      ON gs.booklet_id = bk.id
     AND gs.grader_id = ?

    LEFT JOIN grading_score_drafts gsd
      ON gsd.slot_id = gs.id
     AND gsd.status = 'DRAFT'

    WHERE b.id = ?

    ORDER BY bk.random_num, gs.subject_id, gs.question_no, gs.id
  `;

  const [rows] = await conn.query<getScoreDraftForGrader[]>(sql, [
    graderId,
    bagId,
  ]);

  return rows;
}
async getActiveDraftsByLock(
  conn: PoolConnection,
  graderId: number
): Promise<getScoreDraftForGrader[]> {
  const sql = `
SELECT
  b.id AS bag_id,
  b.bag_no,

  bk.id AS booklet_id,
  bk.random_num,
  bk.qr_payload AS payload,


  gs.id AS slot_id,
  gs.subject_id,
  s.name AS subject_name,         

  gs.question_no,
  sq.label AS question_label,      

  gs.grader_id,
  gs.grader_order,
  gs.status AS slot_status,

  gsd.id AS draft_id,
  gsd.score,
  gsd.status AS draft_status,
  gsd.created_at,
  gsd.updated_at,

  CASE
    WHEN gs.id IS NULL THEN 'ยังไม่มี slot'
    WHEN gsd.id IS NULL THEN 'มี slot แต่ยังไม่ตรวจ'
    ELSE 'ตรวจแล้ว'
  END AS progress_status

FROM grader_work_locks gwl

JOIN bags b
  ON b.id = gwl.bag_id

JOIN booklets bk
  ON bk.bag_id = b.id

LEFT JOIN grading_slots gs
  ON gs.booklet_id = bk.id
 AND gs.grader_id = gwl.grader_id
 AND gs.question_no = gwl.question_no

--  JOIN วิชา
LEFT JOIN subjects s
  ON s.id = gs.subject_id

--  JOIN หัวข้อข้อสอบ
LEFT JOIN subject_questions sq
  ON sq.subject_id = gs.subject_id
 AND sq.question_no = gs.question_no

LEFT JOIN grading_score_drafts gsd
  ON gsd.slot_id = gs.id
 AND gsd.status = 'DRAFT'

WHERE gwl.grader_id = ?
  AND gwl.status = 'ACTIVE'

ORDER BY bk.random_num, gs.question_no;
  `;

  const [rows] = await conn.query<getScoreDraftForGrader[]>(sql, [graderId]);
  return rows;
}

//ใหม่เพื่อสำหรับการสแกนซ้ำ
async findDraftSlotForGrader(
  conn: PoolConnection,
  bookletId: number,
  subjectId: number,
  questionNo: number,
  graderId: number
): Promise<GradingSlotRow | null> {
  const sql = `
    SELECT s.*
    FROM grading_slots s
    JOIN grading_score_drafts d
      ON d.slot_id = s.id
     AND d.status = 'DRAFT'
    WHERE s.booklet_id = ?
      AND s.subject_id = ?
      AND s.question_no = ?
      AND s.grader_id = ?
    LIMIT 1
    FOR UPDATE
  `;

  const [rows] = await conn.query<GradingSlotRow[]>(sql, [
    bookletId,
    subjectId,
    questionNo,
    graderId,
  ]);

  return rows[0] ?? null;
}
}




const gradingscoredraftRepo = new GradingScoreDraftRepo();
export default gradingscoredraftRepo;