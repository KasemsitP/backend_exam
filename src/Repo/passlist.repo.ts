


import { DB } from "../model/DB";
import { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";

export type PassListRow = {
    userCode: string;
    title: string | null;
    fullName: string;      // คุณอาจเก็บ full_name ใน users อยู่แล้ว
    finalScore: number | null;
};

type SortKey = "score" | "examCode" | "name";
type SortOrder = "asc" | "desc";

const SORT_MAP: Record<SortKey, string> = {
    score: "uc.final_score",
    examCode: "u.user_code",
    name: "u.full_name",
};

const ORDER_MAP: Record<SortOrder, string> = {
    asc: "ASC",
    desc: "DESC",
};

class PassListRepo {
    private pool: Pool;
    constructor() {
        this.pool = DB.getInstance();
    }
    async getPassListRows(opts: {
        campaignId: number;
        sort: SortKey;
        order: SortOrder;
    }): Promise<{
        examInfo: { year_be: string; site: string; campaign_size: string };
        rows: PassListRow[];
    }> {
        const [examRows] = await this.pool.query(
            `
      SELECT year_be, site, campaign_size
      FROM exam_campaigns
      WHERE id = ?
      LIMIT 1
      `,
            [opts.campaignId]
        );

        const examInfo = (examRows as any[])[0];
        if (!examInfo) throw new Error("ไม่พบ campaign");

        const sortCol = SORT_MAP[opts.sort] ?? SORT_MAP.score;
        const sortDir = ORDER_MAP[opts.order] ?? "DESC";

        // NOTE: เงื่อนไข "ผ่านข้อเขียน" คุณคุมได้เอง เช่น final_score >= 50
        const [rows] = await this.pool.query(
            `
      SELECT
        u.user_code AS userCode,
        u.title AS title,
        u.full_name AS fullName,
        uc.final_score AS finalScore
      FROM user_campaigns uc
      JOIN users u ON u.id = uc.user_id
      WHERE uc.campaign_id = ?
        AND (uc.final_score IS NOT NULL)
      ORDER BY
        ${sortCol} ${sortDir},
        u.user_code ASC
      `,
            [opts.campaignId]
        );

        return { examInfo, rows: rows as PassListRow[] };
    }
}

export default new PassListRepo();
