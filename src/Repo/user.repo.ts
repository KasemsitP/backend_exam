
import { DB } from "../model/DB";
import { Pool } from "mysql2/promise";
import { RowDataPacket } from "mysql2";



class userRepo {
    private pool: Pool;
    constructor() {
        this.pool = DB.getInstance();
    }

    async getUsersByCampaign(campaignCode: string) {

        const sql = `
  SELECT u.id, u.full_name
  FROM users u
  WHERE EXISTS (
    SELECT 1
    FROM user_sessions us
    JOIN sessions s ON s.id = us.session_id
    JOIN exam_campaigns c ON c.id = s.campaign_id
    WHERE us.user_id = u.id
      AND c.code = ?
  )
  ORDER BY u.full_name
  
`;
        const [rows] = await this.pool.execute<RowDataPacket[]>(sql, [campaignCode]);
        return rows;
    }
}


const userepo = new userRepo()
export default userepo