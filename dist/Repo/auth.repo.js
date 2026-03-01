"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const DB_1 = require("../model/DB");
class Authrepo {
    constructor() {
        this.pool = DB_1.DB.getInstance();
    }
    checkUsername(username) {
        return __awaiter(this, void 0, void 0, function* () {
            const [rows] = yield this.pool.execute("SELECT * FROM accounts WHERE username = ?", [username]);
            return rows;
        });
    }
    checkRole(roleId) {
        return __awaiter(this, void 0, void 0, function* () {
            const [rows] = yield this.pool.execute("SELECT * FROM roles WHERE id = ?", [roleId]);
            return rows[0];
        });
    }
    createAccount(userdata) {
        return __awaiter(this, void 0, void 0, function* () {
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
            const [result] = yield this.pool.execute(sql, params);
            return result.insertId;
        });
    }
    findByUsername(username) {
        return __awaiter(this, void 0, void 0, function* () {
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
            const [rows] = yield this.pool.execute(sql, [username]);
            return rows[0] || null;
        });
    }
    findMeById(ID) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
SELECT a.id, a.username, a.full_name, a.active, r.code AS role_code, a.manager_order FROM accounts a
LEFT JOIN roles r ON r.id = a.role_id
WHERE a.id = ?
LIMIT 1;
    `;
            const [rows] = yield this.pool.execute(sql, [ID]);
            return rows[0] || null;
        });
    }
    findMeByIdAndPassword(ID) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
SELECT a.*, r.code AS role_code
FROM accounts a
LEFT JOIN roles r ON r.id = a.role_id
WHERE a.id = ?
LIMIT 1;
    `;
            const [rows] = yield this.pool.execute(sql, [ID]);
            return rows[0] || null;
        });
    }
    getActiveCampaigns() {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `SELECT id FROM exam_campaigns WHERE is_active = 1`;
            const [rows] = yield this.pool.execute(sql);
            return rows;
        });
    }
    findAllAccountsWithRoles() {
        return __awaiter(this, void 0, void 0, function* () {
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
            const [rows] = yield this.pool.execute(sql);
            return rows;
        });
    }
    findAllAccountsGraderByCampaign(campaign) {
        return __awaiter(this, void 0, void 0, function* () {
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
            const [rows] = yield this.pool.execute(sql, [campaign]);
            return rows;
        });
    }
    findAllRoles() {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `SELECT * FROM roles WHERE active = true ORDER BY id ASC;`;
            const [rows] = yield this.pool.execute(sql);
            return rows;
        });
    }
    updateAccount(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            let sql;
            let params;
            if (data.password_hash) {
                // (ถ้ามีรหัสใหม่)
                sql = `
        UPDATE accounts
        SET full_name = ?, email = ?, role_id = ?, active = ?, password_hash = ?
        WHERE id = ?;
    `;
                params = [data.full_name, data.email, data.role_id, data.active, data.password_hash, id];
            }
            else {
                // (ถ้าไม่มีรหัสใหม่)
                sql = `
        UPDATE accounts
        SET full_name = ?, email = ?, role_id = ?, active = ?
        WHERE id = ?;
    `;
                params = [data.full_name, data.email, data.role_id, data.active, id];
            }
            const [result] = yield this.pool.execute(sql, params);
            return result;
        });
    }
    deleteAccount(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `DELETE FROM accounts WHERE id = ?;`;
            const [result] = yield this.pool.execute(sql, [id]);
            return result;
        });
    }
    deleteAccountWithRelations(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const conn = yield this.pool.getConnection();
            try {
                yield conn.beginTransaction();
                console.log(id);
                yield conn.execute("DELETE ga FROM grader_assignments AS ga INNER JOIN graders AS g ON g.id = ga.grader_id WHERE g.account_id = ?;", [id]);
                yield conn.execute("DELETE FROM graders WHERE account_id = ?", [id]);
                yield conn.execute("DELETE FROM accounts WHERE id = ?", [id]);
                yield conn.commit();
            }
            catch (e) {
                yield conn.rollback();
                throw e;
            }
            finally {
                conn.release();
            }
        });
    }
    updateAuthsession(id, sessionid) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(id, sessionid);
            const sql = `UPDATE auth_sessions SET account_id = ? WHERE sid = ?`;
            const [result] = yield this.pool.execute(sql, [id, sessionid]);
            return result;
        });
    }
    revokeAccountById(accountId) {
        return __awaiter(this, void 0, void 0, function* () {
            const conn = yield this.pool.getConnection();
            try {
                yield conn.beginTransaction();
                yield conn.execute("UPDATE accounts SET active = 0, session_version = session_version + 1 WHERE id = ?", [accountId]);
                yield conn.execute("DELETE FROM auth_sessions WHERE account_id = ?", [accountId]);
                yield conn.commit();
            }
            catch (e) {
                yield conn.rollback();
                throw e;
            }
            finally {
                conn.release();
            }
        });
    }
    unrevokeAccountById(accountId) {
        return __awaiter(this, void 0, void 0, function* () {
            const conn = DB_1.DB.getInstance();
            yield conn.execute("UPDATE accounts SET active = 1 WHERE id = ?", [accountId]);
        });
    }
    findAccountBasicById(accountId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const conn = DB_1.DB.getInstance();
            const [rows] = yield conn.execute("SELECT id, username, full_name, active, session_version FROM accounts WHERE id = ? LIMIT 1", [accountId]);
            return (_a = rows === null || rows === void 0 ? void 0 : rows[0]) !== null && _a !== void 0 ? _a : null;
        });
    }
    checkRoleByID(account_id) {
        return __awaiter(this, void 0, void 0, function* () {
            const [rows] = yield this.pool.execute("SELECT r.id , r.code FROM accounts a join roles r on a.role_id = r.id WHERE a.id = ?", [account_id]);
            return rows[0];
        });
    }
}
const authrepo = new Authrepo();
exports.default = authrepo;
