
import { DB } from "../model/DB";
import { Pool, PoolConnection } from "mysql2/promise";
import { RowDataPacket, ResultSetHeader } from "mysql2";

export interface UserData {
    username: string;
    password: string;
    full_name: string;
    email: string;
    role: number;
    manager_order: number;
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

    async checkRole(roleId: number): Promise<RowDataPacket> {
        const [rows] = await this.pool.execute<RowDataPacket[]>(
            "SELECT * FROM roles WHERE id = ?",
            [roleId]
        );
        return rows[0];
    }
    async createAccount(userdata: UserData): Promise<number> {
        const sql = `
    INSERT INTO accounts (username, password_hash, full_name, email, role_id, active, manager_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
        const params = [
            userdata.username,
            userdata.password,
            userdata.full_name,
            userdata.email,
            userdata.role,
            1,
            userdata.manager_order
        ];

        const [result] = await this.pool.execute<ResultSetHeader>(sql, params);
        return result.insertId;
    }
    async findByUsername(username: string): Promise<RowDataPacket | null> {
        const sql = `
SELECT 
    a.*, 
    r.code as role_code,
    g.id as grader_id,
    g.campaign_id
FROM accounts a
INNER JOIN roles r 
    ON a.role_id = r.id
LEFT JOIN graders g 
    ON g.account_id = a.id
LEFT JOIN exam_campaigns ec
    ON ec.id = g.campaign_id
WHERE 
    a.username = ?
    AND (
        g.id IS NULL               -- ไม่ใช่ grader → ผ่านเลย
        OR ec.is_active = 1        -- เป็น grader → ต้อง active
    );
    `;
        const [rows] = await this.pool.execute<RowDataPacket[]>(sql, [username]);
        return rows[0] || null;
    }
    async findMeById(ID: number): Promise<RowDataPacket | null> {
        const sql = `
SELECT a.id, a.username, a.full_name, a.active, r.code AS role_code, a.manager_order FROM accounts a
LEFT JOIN roles r ON r.id = a.role_id
WHERE a.id = ?
LIMIT 1;
    `;
        const [rows] = await this.pool.execute<RowDataPacket[]>(sql, [ID]);
        return rows[0] || null;
    }

    async findMeByIdAndPassword(ID: number): Promise<RowDataPacket | null> {
        const sql = `
SELECT a.*, r.code AS role_code
FROM accounts a
LEFT JOIN roles r ON r.id = a.role_id
WHERE a.id = ?
LIMIT 1;
    `;
        const [rows] = await this.pool.execute<RowDataPacket[]>(sql, [ID]);
        return rows[0] || null;
    }
    async getActiveCampaigns(): Promise<RowDataPacket[]> {
        const sql = `SELECT id FROM exam_campaigns WHERE is_active = 1`;
        const [rows] = await this.pool.execute<RowDataPacket[]>(sql);
        return rows;
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
    async findAllAccountsGraderByCampaign(campaign: number): Promise<RowDataPacket[]> {
        const sql = `
SELECT 
    a.id, a.username, a.full_name, a.email, a.active, a.role_id,
    r.code as role_code,
    r.name as role_name
FROM 
    accounts a
JOIN 
    graders g ON a.id = g.account_id AND g.campaign_id = ?
LEFT JOIN 
    roles r ON a.role_id = r.id AND r.code = 'GRADER' 
ORDER BY a.id ASC;
`;
        const [rows] = await this.pool.execute<RowDataPacket[]>(sql, [campaign]);
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
    async deleteAccountWithRelations(id: number) {
        const conn = await this.pool.getConnection();
        try {
            await conn.beginTransaction();
            console.log(id) 
            await conn.execute(
                "DELETE ga FROM grader_assignments AS ga INNER JOIN graders AS g ON g.id = ga.grader_id WHERE g.account_id = ?;",[id]
            )
            
            await conn.execute(
                "DELETE FROM graders WHERE account_id = ?",
                [id]
            );

            await conn.execute(
                "DELETE FROM accounts WHERE id = ?",
                [id]
            );

            await conn.commit();
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    }


    async updateAuthsession(id: number, sessionid: string): Promise<ResultSetHeader> {
        console.log(id, sessionid)
        const sql = `UPDATE auth_sessions SET account_id = ? WHERE sid = ?`;
        const [result] = await this.pool.execute<ResultSetHeader>(sql, [id, sessionid]);
        return result;
    }
    async revokeAccountById(accountId: number) {
        const conn: PoolConnection = await this.pool.getConnection();

        try {
            await conn.beginTransaction();

            await conn.execute(
                "UPDATE accounts SET active = 0, session_version = session_version + 1 WHERE id = ?",
                [accountId]
            );

            await conn.execute(
                "DELETE FROM auth_sessions WHERE account_id = ?",
                [accountId]
            );

            await conn.commit();
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    }

    async unrevokeAccountById(accountId: number) {
        const conn = DB.getInstance();
        await conn.execute(
            "UPDATE accounts SET active = 1 WHERE id = ?",
            [accountId]
        );
    }
    async findAccountBasicById(accountId: number) {
        const conn = DB.getInstance();
        const [rows]: any = await conn.execute(
            "SELECT id, username, full_name, active, session_version FROM accounts WHERE id = ? LIMIT 1",
            [accountId]
        );
        return rows?.[0] ?? null;
    }

        async checkRoleByID(account_id: number): Promise<RowDataPacket> {
        const [rows] = await this.pool.execute<RowDataPacket[]>(
            "SELECT r.id , r.code FROM accounts a join roles r on a.role_id = r.id WHERE a.id = ?",
            [account_id]
        );
        return rows[0];
    }
}
const authrepo = new Authrepo()
export default authrepo

    