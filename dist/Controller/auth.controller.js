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
exports.authcontroller = void 0;
const auth_service_1 = require("../Service/auth.service");
const utills_1 = require("../utills/utills");
const DB_1 = require("../model/DB");
const auth_repo_1 = __importDefault(require("../Repo/auth.repo"));
const grader_repo_1 = __importDefault(require("../Repo/grader.repo"));
class authcontroller {
}
exports.authcontroller = authcontroller;
_a = authcontroller;
authcontroller.register = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _b;
    const conn = yield DB_1.DB.getInstance().getConnection();
    try {
        const { username, password, full_name, email, role, campaignId, manager_order } = req.body;
        yield conn.beginTransaction();
        // 1. เช็ค Role ก่อนเป็นอันดับแรก
        const roleExists = yield auth_repo_1.default.checkRole(role);
        if (!roleExists)
            throw new Error("ไม่พบ role ที่ระบุ");
        const isGrader = roleExists.code === "GRADER";
        // 2. แปลง Username หากเป็น Grader และมี CampaignId
        let finalUsername = username;
        if (isGrader && campaignId) {
            finalUsername = `${campaignId}_${username}`;
        }
        // 3. เช็คว่ามี Username (ที่แปลงแล้ว) ซ้ำหรือไม่
        yield auth_service_1.authservice.IsDuplicate(finalUsername);
        const hash = yield utills_1.utills.hash(password);
        // 4. บันทึกข้อมูลด้วย finalUsername
        const userData = {
            username: finalUsername,
            password: hash,
            full_name,
            email,
            role,
            campaignId,
            manager_order: manager_order !== null && manager_order !== void 0 ? manager_order : null
        };
        // ... (โค้ดส่วนที่เหลือเหมือนเดิม) ...
        const insertId = yield auth_repo_1.default.createAccount(userData);
        const accountId = insertId;
        if (!accountId)
            throw new Error("สร้างบัญชีไม่สำเร็จ");
        console.log(accountId);
        console.log(isGrader, campaignId);
        if (isGrader && campaignId) {
            yield grader_repo_1.default.create({
                account_id: accountId,
                campaign_id: Number(campaignId),
            }, conn);
        }
        yield conn.commit();
        return res.status(201).json({ message: "ลงทะเบียนสำเร็จ", id: accountId, username: finalUsername });
    }
    catch (error) {
        console.error("Registration error:", error.message);
        yield conn.rollback();
        return res
            .status(400)
            .json({ message: (_b = error.message) !== null && _b !== void 0 ? _b : "register failed" });
    }
    finally {
        conn.release();
    }
});
//   static register = async (req: Request, res: Response) => {
//   try {  //full name not null , role
//     const { username, password, full_name, email, role } = req.body;
//     await authservice.IsDuplicate(username)
//     const hash = await utills.hash(password)
//     const userData = { username, password: hash, full_name, email, role };
//     const result = await authrepo.createAccount(userData)
//     res.status(201).send({ message: "ลงทะเบียนสำเร็จ", id: result });
//   } catch (error: any) {
//     return res.status(400).send({ message: error.message });
//   }
// }
authcontroller.login = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // 1. รับค่า campaignId (หรือ campaign_id แล้วแต่หน้าบ้านส่งมา) เพิ่มเติม
    const { username, password, campaignId } = req.body;
    console.log(req.body);
    try {
        // 2. ส่ง campaignId เข้าไปเช็คด้วย (ถ้าไม่มีก็ส่ง undefined ไป ซึ่ง service จะค้นหาแบบปกติ)
        const result = yield auth_service_1.authservice.CheckUsername(username, password);
        if (Number(result.active) !== 1) {
            throw new Error("บัญชีถูกระงับการใช้งาน");
        }
        const userId = Number(result.id);
        const conn = DB_1.DB.getInstance();
        // ลบ session เก่าทั้งหมดของ user (บังคับเครื่องเดียว)
        yield conn.execute("DELETE FROM auth_sessions WHERE account_id = ?", [userId]);
        // regenerate session ใหม่
        yield new Promise((resolve, reject) => {
            req.session.regenerate((err) => (err ? reject(err) : resolve()));
        });
        // 3. set session ใหม่
        req.session.userId = userId;
        req.session.sessionVersion = Number(result.sessionVersion);
        req.session.roles = result.roles;
        // แนะนำ: เก็บ campaignId ไว้ใน session ด้วย เพื่อให้ระบบจำได้ว่าล็อคอินรอบไหน
        // (ดึงมาจาก result.campaignId ที่เราเพิ่มไว้ใน authservice)
        if (result.campaignId) {
            req.session.campaignId = Number(result.campaignId);
        }
        // save session แบบให้ชัวร์ว่าเซฟเสร็จ
        yield new Promise((resolve, reject) => {
            req.session.save((err) => {
                if (err)
                    return reject(err);
                resolve();
            });
        });
        // ผูก sid ใหม่กับ account_id
        try {
            yield auth_repo_1.default.updateAuthsession(userId, req.sessionID);
        }
        catch (dbErr) {
            console.error("Failed to map account_id to session:", dbErr);
        }
        const new_username = result.username.split("_").slice(1).join("_"); // ถ้าเป็น grader ให้ตัด campaignId ออก
        result.username = new_username || result.username; // กันกรณีที่ไม่มี underscore หรือไม่ใช่ grader ให้ใช้ username เดิม
        console.log("Login result:", result);
        return res.status(200).json({
            message: "เข้าสู่ระบบสำเร็จ",
            user: result,
        });
    }
    catch (error) {
        console.log("Login error:", error.message);
        return res.status(400).json({ message: error.message });
    }
});
authcontroller.getMe = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.session.userId;
        if (!userId)
            return res.status(401).json({ message: "ไม่ได้รับอนุญาต" });
        // ดึงข้อมูลสดจาก DB (รวม roles)
        const row = yield auth_repo_1.default.findMeById(userId);
        if (!row)
            return res.status(401).json({ message: "ไม่ได้รับอนุญาต" });
        // กัน user โดน revoke
        if (Number(row.active) !== 1) {
            req.session.destroy(() => { });
            return res.status(403).json({ message: "บัญชีถูกระงับการใช้งาน" });
        }
        const roleCode = (row.role_code || "staff").toLowerCase();
        const new_username = row.username.split("_").slice(1).join("_"); // ถ้าเป็น grader ให้ตัด campaignId ออก
        row.username = new_username || row.username; // กันกรณีที่ไม่มี underscore หรือไม่ใช่ grader ให้ใช้ username เดิม
        return res.status(200).json({
            id: String(row.id),
            name: row.full_name,
            username: row.username,
            roles: [roleCode],
            manager_order: row.manager_order
        });
    }
    catch (e) {
        return res.status(500).json({ message: e.message });
    }
});
authcontroller.logout = (req, res) => {
    if (!req.session) {
        return res.status(200).json({ message: "ออกจากระบบแล้ว" });
    }
    req.session.destroy((err) => {
        if (err) {
            console.error("Failed to destroy session:", err);
            return res.status(500).json({ message: "ออกจากระบบไม่สำเร็จ" });
        }
        // ชื่อ cookie ต้องตรงกับ session.name ในตอน config เช่น "sid"
        res.clearCookie("sid");
        return res.status(200).json({ message: "ออกจากระบบสำเร็จ" });
    });
};
authcontroller.getAll = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const accounts = yield auth_service_1.authservice.getAllAccounts();
        res.status(200).json(accounts);
    }
    catch (error) {
        res.status(500).send({ message: error.message });
    }
});
authcontroller.getAllGraders = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const campaign_id = parseInt(req.params.id, 10);
    try {
        const accounts = yield auth_service_1.authservice.getAllGradersAccounts(Number(campaign_id));
        console.log("Graders for campaign", campaign_id, accounts); // เพิ่ม log เพื่อตรวจสอบข้อมูลที่ได้จาก service
        res.status(200).json(accounts);
    }
    catch (error) {
        res.status(500).send({ message: error.message });
    }
});
authcontroller.getRoles = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const roles = yield auth_service_1.authservice.getAllRoles();
        res.status(200).json(roles);
    }
    catch (error) {
        res.status(500).send({ message: error.message });
    }
});
authcontroller.update = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = parseInt(req.params.id, 10);
        const data = req.body;
        const updatedAccount = yield auth_service_1.authservice.updateAccount(id, data);
        res.status(200).json(updatedAccount);
    }
    catch (error) {
        res.status(500).send({ message: error.message });
    }
});
authcontroller.delete = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log("Deleting account id:", req.params.id);
        const id = parseInt(req.params.id, 10);
        yield auth_service_1.authservice.deleteAccount(id);
        res.status(200).json({ id: id });
    }
    catch (error) {
        res.status(500).send({ message: error.message });
    }
});
authcontroller.revokeAccount = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const targetId = Number(req.params.id);
        if (Number.isNaN(targetId)) {
            return res.status(400).json({ message: "Invalid account id" });
        }
        // actor id (คนที่กด revoke) ถ้าคุณเก็บใน session
        const actorId = req.session.userId;
        const result = yield auth_service_1.authservice.revokeAccount(targetId, actorId);
        return res.status(200).json(Object.assign({ message: "revoked" }, result));
    }
    catch (e) {
        return res.status(400).json({ message: e.message });
    }
});
authcontroller.unrevokeAccount = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const targetId = Number(req.params.id);
        if (Number.isNaN(targetId)) {
            return res.status(400).json({ message: "Invalid account id" });
        }
        const result = yield auth_service_1.authservice.unrevokeAccount(targetId);
        return res.status(200).json(Object.assign({ message: "unrevoked" }, result));
    }
    catch (e) {
        return res.status(400).json({ message: e.message });
    }
});
