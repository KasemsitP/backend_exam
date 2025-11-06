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
const auth_repo_1 = __importDefault(require("../Repo/auth.repo"));
class authcontroller {
}
exports.authcontroller = authcontroller;
_a = authcontroller;
authcontroller.register = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try { //full name not null , role
        const { username, password, full_name, email, role } = req.body;
        yield auth_service_1.authservice.IsDuplicate(username);
        const hash = yield utills_1.utills.hash(password);
        const userData = { username, password: hash, full_name, email, role };
        const result = yield auth_repo_1.default.createAccount(userData);
        res.status(201).send({ message: "ลงทะเบียนสำเร็จ" });
    }
    catch (error) {
        return res.status(400).send({ message: error.message });
    }
});
authcontroller.login = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, password } = req.body;
    try {
        const result = yield auth_service_1.authservice.CheckUsername(username, password);
        req.session.userId = result.id;
        req.session.userData = result;
        res.status(201).send({ message: "เข้าสู่ระบบสำเร็จ" });
    }
    catch (error) {
        return res.status(400).send({ message: error.message });
    }
});
authcontroller.getMe = (req, res) => {
    if (req.session.userData) {
        res.status(200).json(req.session.userData);
    }
    else {
        res.status(401).send({ message: "Not authenticated" });
    }
};
authcontroller.logout = (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).send({ message: "ออกจากระบบไม่สำเร็จ" });
        }
        res.clearCookie("connect.sid");
        res.send({ message: "ออกจากระบบเรียบร้อยแล้ว" });
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
        const id = parseInt(req.params.id, 10);
        yield auth_service_1.authservice.deleteAccount(id);
        res.status(200).json({ id: id });
    }
    catch (error) {
        res.status(500).send({ message: error.message });
    }
});
