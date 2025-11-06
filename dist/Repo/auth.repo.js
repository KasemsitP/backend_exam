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
    createAccount(userdata) {
        return __awaiter(this, void 0, void 0, function* () {
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
            const [result] = yield this.pool.execute(sql, params);
            return result;
        });
    }
    findByUsername(username) {
        return __awaiter(this, void 0, void 0, function* () {
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
            const [rows] = yield this.pool.execute(sql, [username]);
            return rows[0] || null;
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
}
const authrepo = new Authrepo();
exports.default = authrepo;
