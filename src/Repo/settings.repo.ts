import { DB } from "../model/DB"; // (สมมติว่านี่คือไฟล์ DB Pool ของคุณ)
import { Pool, PoolConnection } from "mysql2/promise";
import { RowDataPacket } from "mysql2";



interface CampStatus extends RowDataPacket {
    id: number
    is_active: number
}
interface KeyStatus extends RowDataPacket {
    id: number
    active: number
}


type DbClient = Pool | PoolConnection;

class SettingsRepo {
    private pool: Pool;
    constructor() {
        this.pool = DB.getInstance();
    }


    async CampStatus(campaign_id: number, dbClient: DbClient = this.pool): Promise<CampStatus[]> {
        const sql = `SELECT * FROM exam_campaigns WHERE id = ?`
        const [rows] = await dbClient.execute<CampStatus[]>(sql, [campaign_id]);
        return rows;
    }

    async QRStatus(campaign_id: number, dbClient: DbClient = this.pool): Promise<boolean> {
        const sql = `SELECT ec.qr_active  FROM exam_campaigns ec WHERE ec.id = ?`
        const [rows] = await dbClient.execute<KeyStatus[]>(sql, [campaign_id]);
        return rows[0]?.qr_active === 1;
    }


}

const settingsRepo = new SettingsRepo();
export default settingsRepo;

