
import { DB } from "../model/DB";
import { Pool } from "mysql2/promise";
import { RowDataPacket  } from "mysql2";

export interface UserData {
    username: string;
    password: string;
    full_name: string;
    email: string;
    role: number;
}


class Authrepo {
    private pool: Pool
    constructor() {
        this.pool = DB.getInstance();
    }
    async checkUsername(username: string): Promise<RowDataPacket[]> {

        const [rows] = await this.pool.execute<RowDataPacket[]>(
            "SELECT * FROM accounts WHERE username = ?",
            [username]
        );
        return rows;



    }
    async createAccount(userdata: UserData): Promise<RowDataPacket[]> {

        const sql = `
      INSERT INTO accounts (username, password_hash, full_name, email, role_id, active)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE full_name = VALUES(full_name);
    `;
        const params = [
            userdata.username,
            userdata.password,
            userdata.full_name,
            userdata.email,
            userdata.role,
            1
        ];

        const [result] = await this.pool.execute<RowDataPacket[]>(sql, params);
        return result;



    }
async findByUsername(username: string): Promise<RowDataPacket | null> {
    const sql = `
        SELECT 
            a.*, 
            r.code as role_code 
        FROM 
            accounts a
        LEFT JOIN 
            roles r ON a.role_id = r.id
        WHERE 
            a.username = ?
    `;
    const [rows] = await this.pool.execute<RowDataPacket[]>(sql, [username]);
    return rows[0] || null; 
}

}
const authrepo = new Authrepo()
export default authrepo