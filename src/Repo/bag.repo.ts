


import { DB } from "../model/DB";
import { Pool } from "mysql2/promise";
import { RowDataPacket  , ResultSetHeader} from "mysql2";



class bagRepo {
    private pool: Pool
    constructor() {
        this.pool = DB.getInstance();
    }
    async getBags(campaign_code: string): Promise<RowDataPacket[]> {

        const sql = `
      SELECT
  b.*,
  s.session_code,
  c.code AS campaign_code
FROM bags b
JOIN sessions s        ON s.id = b.session_id
JOIN exam_campaigns c  ON c.id = s.campaign_id
WHERE c.code = ?                  
ORDER BY s.session_code, b.bag_no;
    `;
        const params = [
            campaign_code
        ];
        const [result] = await this.pool.execute<RowDataPacket[]>(sql, params);
        return result;
    }
    async getNumberBags(campaign_code: string): Promise<RowDataPacket[]> {
        const sql = `
SELECT
  c.code AS campaign_code,
  s.session_code,
  b.bag_no,
  COUNT(bk.id) AS booklet_count
FROM bags b
JOIN sessions s        ON s.id = b.session_id
JOIN exam_campaigns c  ON c.id = s.campaign_id
LEFT JOIN booklets bk  ON bk.session_id = b.session_id AND bk.bag_no = b.bag_no
WHERE c.code = ?                      -- 'Y68-T2'
GROUP BY c.code, s.session_code, b.bag_no
ORDER BY s.session_code, b.bag_no;

    `;
        const params = [
            campaign_code
        ];
        const [result] = await this.pool.execute<RowDataPacket[]>(sql, params);
        return result;
    }
    async insertBag(session_code: string , bag_num : Number, count_item : Number ): Promise<ResultSetHeader> {
        const sql = `
INSERT INTO bags (session_id, bag_no, sid_start, sid_end, count_items, status)
SELECT s.id, ?, NULL, NULL, ?, 'CREATED'
FROM sessions s WHERE s.session_code = ?;
    `;
        const params = [
            bag_num,
            count_item,
            session_code
        ];
        const [result] = await this.pool.execute<ResultSetHeader>(sql, params);
        return result;
    }

}
const bagrepo = new bagRepo()
export default bagrepo