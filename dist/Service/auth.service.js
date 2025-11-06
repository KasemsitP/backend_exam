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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.authservice = void 0;
const auth_repo_1 = __importDefault(require("../Repo/auth.repo"));
const utills_1 = require("../utills/utills");
class authservice {
}
exports.authservice = authservice;
_a = authservice;
authservice.IsDuplicate = (username) => __awaiter(void 0, void 0, void 0, function* () {
    const row = yield auth_repo_1.default.checkUsername(username);
    if (row.length) {
        throw new Error("มีชื่อผู้ใช้งานซ้ำ");
    }
});
authservice.CheckUsername = (username, password) => __awaiter(void 0, void 0, void 0, function* () {
    const row = yield auth_repo_1.default.findByUsername(username);
    if (!row)
        throw new Error("ไม่พบผู้ใช้");
    const match = yield utills_1.utills.bcryptCompare(password, row.password_hash);
    if (!match)
        throw new Error("รหัสผ่านไม่ถูกต้อง");
    const { password_hash } = row, secureUserData = __rest(row, ["password_hash"]);
    const roleCode = (row.role_code || "staff").toLowerCase(); // "admin"
    return {
        id: secureUserData.id.toString(),
        name: secureUserData.full_name,
        username: secureUserData.username,
        roles: [roleCode]
    };
});
authservice.getAllAccounts = () => __awaiter(void 0, void 0, void 0, function* () {
    const rows = yield auth_repo_1.default.findAllAccountsWithRoles();
    // (แปลง active (0/1) เป็น boolean)
    return rows.map(row => (Object.assign(Object.assign({}, row), { active: !!row.active })));
});
authservice.getAllRoles = () => __awaiter(void 0, void 0, void 0, function* () {
    return yield auth_repo_1.default.findAllRoles();
});
authservice.updateAccount = (id, data) => __awaiter(void 0, void 0, void 0, function* () {
    const updateData = {
        full_name: data.full_name,
        email: data.email,
        role_id: data.role_id,
        active: data.active
    };
    // (ถ้ารหัสใหม่ถูกส่งมา ให้ Hash มันด้วย)
    if (data.newPassword) {
        updateData.password_hash = yield utills_1.utills.hash(data.newPassword);
    }
    yield auth_repo_1.default.updateAccount(id, updateData);
    // (ดึงข้อมูลที่อัปเดตแล้วกลับไป)
    const updatedRows = yield auth_repo_1.default.findAllAccountsWithRoles();
    const updatedAccount = updatedRows.find(acc => acc.id === id);
    if (!updatedAccount) {
        throw new Error("ไม่พบผู้ใช้หลังจากอัปเดต"); // หรือจัดการ error ตามต้องการ
    }
    return Object.assign(Object.assign({}, updatedAccount), { active: !!updatedAccount.active });
});
authservice.deleteAccount = (id) => __awaiter(void 0, void 0, void 0, function* () {
    // (TODO: ควรเช็คว่า Account นี้ถูกใช้งานใน Graders หรือไม่ก่อนลบ)
    yield auth_repo_1.default.deleteAccount(id);
    return { id };
});
