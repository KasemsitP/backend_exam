import { PoolConnection, RowDataPacket , Pool } from "mysql2/promise";
import { DB } from "../model/DB";


export interface GraderWorkLockSummary extends RowDataPacket {
  lock_id: number;
  grader_id: number;
  bag_id: number;
  question_no: number;
  status: string;

  bag_no: string;

  session_id: number | null;
  session_code: string | null;
  grader_name: string | null;

  total_booklets: number;
  min_random: number | null;
  max_random: number | null;
  subject_name: string | null;
}


class GraderWorkLockRepo {
    private pool : Pool
    constructor(){
        this.pool = DB.getInstance();
    }


    async findBagReportHeader(
        campaign_id: number
    ): Promise<GraderWorkLockSummary | null> {
        const sql = `
SELECT 
  gw.id AS lock_id,
  gw.grader_id,
  gw.bag_id,
  gw.question_no,
  gw.status,
  a.full_name AS grader_name,

  b.bag_no,
  s.id AS session_id,
  s.session_code,

  sub.id AS subject_id,
  sub.name AS subject_name,

  COUNT(DISTINCT bk.id) AS total_booklets,
  MIN(CAST(bk.random_num AS UNSIGNED)) AS min_random,
  MAX(CAST(bk.random_num AS UNSIGNED)) AS max_random

FROM grader_work_locks gw

LEFT JOIN bags b
  ON b.id = gw.bag_id

LEFT JOIN sessions s
  ON s.id = b.session_id

LEFT JOIN session_subjects ss
  ON ss.session_id = s.id

LEFT JOIN subjects sub
  ON sub.id = ss.subject_id

LEFT JOIN booklets bk
  ON bk.bag_id = b.id

LEFT JOIN graders g
  ON g.id = gw.grader_id

LEFT JOIN accounts a
  ON a.id = g.account_id

WHERE gw.campaign_id = ?
  AND gw.status = 'ACTIVE'

GROUP BY
  gw.id,
  gw.grader_id,
  gw.bag_id,
  gw.question_no,
  gw.status,
  a.full_name,
  b.bag_no,
  s.id,
  s.session_code,
  sub.id,
  sub.name;
    `;

    const [rows] = await this.pool.execute<GraderWorkLockSummary[]>(sql, [campaign_id]);
    return rows.length > 0 ? rows[0] : null;
  }
}

const graderWorkLockRepo = new GraderWorkLockRepo();
export default  graderWorkLockRepo;


