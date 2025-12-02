
import { DB } from "../model/DB";
import { Pool } from "mysql2/promise";
import { RowDataPacket , ResultSetHeader } from "mysql2";

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
    async findAllAccountsWithRoles(): Promise<RowDataPacket[]> {
        const sql = `
SELECT 
    a.id, a.username, a.full_name, a.email, a.active, a.role_id,
    r.code as role_code,
    r.name as role_name
FROM 
    accounts a
LEFT JOIN 
    roles r ON a.role_id = r.id
ORDER BY a.id ASC;
`;

        const [rows] = await this.pool.execute<RowDataPacket[]>(sql);
        return rows;
    }

    async findAllRoles(): Promise<RowDataPacket[]> {
        const sql = `SELECT * FROM roles WHERE active = true ORDER BY id ASC;`;
        const [rows] = await this.pool.execute<RowDataPacket[]>(sql);
        return rows;
    }

    async updateAccount(
        id: number,
        data: { full_name: string; email: string; role_id: number; active: boolean; password_hash?: string }
    ): Promise<RowDataPacket[]> {

        let sql: string;
        let params: any[];

        if (data.password_hash) {
            // (ถ้ามีรหัสใหม่)
    sql = `
        UPDATE accounts
        SET full_name = ?, email = ?, role_id = ?, active = ?, password_hash = ?
        WHERE id = ?;
    `;
            params = [data.full_name, data.email, data.role_id, data.active, data.password_hash, id];
        } else {
            // (ถ้าไม่มีรหัสใหม่)
    sql = `
        UPDATE accounts
        SET full_name = ?, email = ?, role_id = ?, active = ?
        WHERE id = ?;
    `;
            params = [data.full_name, data.email, data.role_id, data.active, id];
        }

        const [result] = await this.pool.execute<RowDataPacket[]>(sql, params);
        return result;
    }

    async deleteAccount(id: number): Promise<RowDataPacket[]> {
        const sql = `DELETE FROM accounts WHERE id = ?;`;
        const [result] = await this.pool.execute<RowDataPacket[]>(sql, [id]);
        return result;
    }

    async updateAuthsession(id: number , sessionid  : string): Promise<ResultSetHeader> {
        console.log(id , sessionid)
        const sql = `UPDATE auth_sessions SET account_id = ? WHERE sid = ?`;
        const [result] = await this.pool.execute<ResultSetHeader>(sql, [id ,sessionid]);
        return result;
    }

}
const authrepo = new Authrepo()
export default authrepo