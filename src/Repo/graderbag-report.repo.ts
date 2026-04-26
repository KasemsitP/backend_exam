import { PoolConnection, RowDataPacket } from "mysql2/promise";

export interface BagReportHeaderRow extends RowDataPacket {
    bag_id: number;
    bag_no: number;
    campaign_name: string | null;
    subject_name: string | null;
    site: string | null;
    start_num: string | null;
    end_num: string | null;
}

export interface BagReportGraderInfoRow extends RowDataPacket {
    full_name: string | null;
}

export interface BagReportScoreRow extends RowDataPacket {
    random_num: string;
    qr_payload: string | null;
    score: number | null;
    grader_order: number | null;
}

export interface BagBookletRow extends RowDataPacket {
    random_num: string;
    qr_payload: string | null;
}

class GraderBagReportRepo {
    async findBagReportHeader(
        conn: PoolConnection,
        bagId: number
    ): Promise<BagReportHeaderRow | null> {
        const sql = `
      SELECT
        b.id AS bag_id,
        b.bag_no,
        ec.name AS campaign_name,
        sub.name AS subject_name,
        ec.site AS site,
        MIN(bk.random_num) AS start_num,
        MAX(bk.random_num) AS end_num
      FROM bags b
      JOIN sessions s
        ON s.id = b.session_id
      JOIN exam_campaigns ec
        ON ec.id = s.campaign_id
      JOIN booklets bk
        ON bk.bag_id = b.id
      LEFT JOIN grading_slots gs
        ON gs.booklet_id = bk.id
      LEFT JOIN subjects sub
        ON sub.id = gs.subject_id
      WHERE b.id = ?
      GROUP BY
        b.id,
        b.bag_no,
        ec.name,
        sub.name,
        ec.site
      LIMIT 1
    `;

        const [rows] = await conn.query<BagReportHeaderRow[]>(sql, [bagId]);
        return rows[0] || null;
    }
    async findGraderInfoByBagId(
        conn: PoolConnection,
        graderId: number
    ): Promise<BagReportGraderInfoRow | null> {
        const sql = `
select a.full_name from accounts a JOIN graders g ON g.account_id = a.id WHERE g.id = ?;
    `;

        const [rows] = await conn.query<BagReportGraderInfoRow[]>(sql, [graderId]);
        return rows[0] || null;
    }
    async findConfirmedScoresByBagId(
        conn: PoolConnection,
        bagId: number,
        questionNo: number,
        graderId: number
    ): Promise<BagReportScoreRow[]> {
        const sql = `
SELECT
  bk.random_num,
  bk.qr_payload,
  gs.question_no,
  gsc.score,
gs.grader_order
FROM bags b
JOIN booklets bk
  ON bk.bag_id = b.id
JOIN grading_slots gs
  ON gs.booklet_id = bk.id
JOIN grading_scores gsc
  ON gsc.slot_id = gs.id
WHERE b.id = ?
  AND gs.question_no = ?
  AND gs.grader_id = ?
ORDER BY CAST(bk.random_num AS UNSIGNED);
    `;

        const [rows] = await conn.query<BagReportScoreRow[]>(sql, [bagId, questionNo, graderId]);
        return rows;
    }

    async findBookletsByBagId(
        conn: PoolConnection,
        bagId: number
    ): Promise<BagBookletRow[]> {
        const sql = `
            SELECT
                bk.random_num,
                bk.qr_payload
            FROM booklets bk
            WHERE bk.bag_id = ?
            ORDER BY CAST(bk.random_num AS UNSIGNED);
        `;

        const [rows] = await conn.query<BagBookletRow[]>(sql, [bagId]);
        return rows;
    }
    async findGraderOrderInBag(
  conn: PoolConnection,
  bagId: number,
  graderId: number,
  questionNo: number
): Promise<number | null> {
  const sql = `
    SELECT
      gs.grader_order
    FROM grading_slots gs
    JOIN booklets bk
      ON bk.id = gs.booklet_id
    WHERE bk.bag_id = ?
      AND gs.grader_id = ?
      AND gs.question_no = ?
    LIMIT 1
  `;

  const [rows] = await conn.query<RowDataPacket[]>(sql, [
    bagId,
    graderId,
    questionNo,
  ]);

  return rows.length ? Number(rows[0].grader_order) : null;
}
}

const graderBagReportRepo = new GraderBagReportRepo();
export default graderBagReportRepo;
