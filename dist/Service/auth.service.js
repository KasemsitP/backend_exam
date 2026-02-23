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
    var _b;
    const row = yield auth_repo_1.default.findByUsername(username);
    if (!row)
        throw new Error("ไม่พบผู้ใช้");
    if (Number(row.active) !== 1)
        throw new Error("บัญชีถูกระงับการใช้งาน");
    const match = yield utills_1.utills.bcryptCompare(password, row.password_hash);
    if (!match)
        throw new Error("รหัสผ่านไม่ถูกต้อง");
    //const { password_hash, ...secureUserData } = row;
    const roleCode = (row.role_code || "staff").toLowerCase();
    return {
        id: row.id,
        name: row.full_name,
        username: row.username,
        roles: [roleCode],
        active: Number(row.active),
        sessionVersion: Number((_b = row.session_version) !== null && _b !== void 0 ? _b : 1),
    };
});
authservice.CheckPasswordByID = (account_id, password) => __awaiter(void 0, void 0, void 0, function* () {
    const row = yield auth_repo_1.default.findMeByIdAndPassword(account_id);
    if (!row)
        throw new Error("ไม่พบผู้ใช้");
    if (Number(row.active) !== 1)
        throw new Error("บัญชีถูกระงับการใช้งาน");
    const match = yield utills_1.utills.bcryptCompare(password, row.password_hash);
    if (!match)
        throw new Error("รหัสผ่านไม่ถูกต้อง");
    const roleCode = (row.role_code).toLowerCase();
    return {
        id: row.id,
        name: row.full_name,
        username: row.username,
        roles: [roleCode],
        active: Number(row.active),
    };
});
authservice.getAllAccounts = () => __awaiter(void 0, void 0, void 0, function* () {
    const rows = yield auth_repo_1.default.findAllAccountsWithRoles();
    // (แปลง active (0/1) เป็น boolean)
    return rows.map(row => (Object.assign(Object.assign({}, row), { active: !!row.active })));
});
authservice.getAllGradersAccounts = (campaign) => __awaiter(void 0, void 0, void 0, function* () {
    const rows = yield auth_repo_1.default.findAllAccountsGraderByCampaign(Number(campaign));
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
authservice.revokeAccount = (targetAccountId, actorAccountId) => __awaiter(void 0, void 0, void 0, function* () {
    // กัน revoke ตัวเอง (optional แต่แนะนำ)
    if (actorAccountId && targetAccountId === actorAccountId) {
        throw new Error("ไม่สามารถระงับบัญชีตัวเองได้");
    }
    const target = yield auth_repo_1.default.findAccountBasicById(targetAccountId);
    if (!target)
        throw new Error("ไม่พบผู้ใช้");
    // console.log(target)
    if (Number(target.active) !== 1) {
        // ถูก revoke อยู่แล้ว
        return { id: target.id, active: false, alreadyRevoked: true };
    }
    yield auth_repo_1.default.revokeAccountById(targetAccountId);
    return { id: targetAccountId, active: false };
});
authservice.unrevokeAccount = (targetAccountId) => __awaiter(void 0, void 0, void 0, function* () {
    const target = yield auth_repo_1.default.findAccountBasicById(targetAccountId);
    if (!target)
        throw new Error("ไม่พบผู้ใช้");
    yield auth_repo_1.default.unrevokeAccountById(targetAccountId);
    return { id: targetAccountId, active: true };
});
authservice.deleteAccount = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const checkRole = yield auth_repo_1.default.checkRoleByID(id);
    console.log(checkRole);
    console.log(id);
    console.log("comes");
    if (checkRole.code === "GRADER") {
        console.log(id);
        yield auth_repo_1.default.deleteAccountWithRelations(id);
    }
    else {
        yield auth_repo_1.default.deleteAccount(id);
    }
    //    await authrepo.deleteAccount(id);
    return { id };
});
