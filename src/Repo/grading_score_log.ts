import {DB} from "../model/DB";
import { PoolConnection , Pool} from "mysql2/promise";




class GradingScoreLogRepo {
    private pool : Pool

    constructor() {
        this.pool = DB.getInstance();
     }
    async getScoreLogByBagId(bagId : number ) {
        const sql = `SELECT
  bg.bag_no AS bag,
  gsl.booklet_id AS booklet,

  s.code AS subject,
  s.name AS subject_name,

  gsl.question_no AS question,

  a1.full_name AS grader1,
  gsl.old_score1 AS score1,

  a2.full_name AS grader2,
  gsl.old_score2 AS score2,

  acc.full_name AS changed_by,
  DATE_FORMAT(gsl.changed_at, '%d/%m/%Y %H:%i') AS changed_time,
   ROUND((COALESCE(gsl.old_score1, 0) + COALESCE(gsl.old_score2, 0)) / 2, 1) AS total_scorerow

FROM grading_score_logs gsl
JOIN booklets b ON b.id = gsl.booklet_id
JOIN bags bg ON bg.id = b.bag_id
JOIN subjects s ON s.id = gsl.subject_id

LEFT JOIN graders g1 ON g1.id = gsl.grader1_id
LEFT JOIN accounts a1 ON a1.id = g1.account_id

LEFT JOIN graders g2 ON g2.id = gsl.grader2_id
LEFT JOIN accounts a2 ON a2.id = g2.account_id

JOIN accounts acc ON acc.id = gsl.changed_by

WHERE b.bag_id = ?

ORDER BY gsl.changed_at DESC;`

        const [rows] = await this.pool.query(sql, [bagId]);
        return rows;
    }
}

const gradingScoreLogRepo = new GradingScoreLogRepo();
export default gradingScoreLogRepo;