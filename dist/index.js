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
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
require("dotenv/config");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const express_session_1 = __importDefault(require("express-session"));
const DB_1 = require("./model/DB");
const routes_auth_1 = __importDefault(require("./Routes/routes.auth"));
const router_user_1 = __importDefault(require("./Routes/router.user"));
const router_bag_1 = __importDefault(require("./Routes/router.bag"));
const router_exam_1 = __importDefault(require("./Routes/router.exam"));
const router_session_1 = __importDefault(require("./Routes/router.session"));
const router_campaign_1 = __importDefault(require("./Routes/router.campaign"));
const router_session_subject_1 = __importDefault(require("./Routes/router.session-subject"));
const router_importuser_1 = __importDefault(require("./Routes/router.importuser"));
const router_key_1 = __importDefault(require("./Routes/router.key"));
const router_user_session_1 = __importDefault(require("./Routes/router.user-session"));
const router_account_1 = require("./Routes/router.account");
const authentication_1 = require("./Middleware/authentication");
const router_roles_1 = require("./Routes/router.roles");
const router_examroom_1 = __importDefault(require("./Routes/router.examroom"));
const router_verify_1 = __importDefault(require("./Routes/router.verify"));
dotenv_1.default.config();
exports.app = (0, express_1.default)();
exports.app.use(express_1.default.json());
exports.app.use((0, cookie_parser_1.default)());
exports.app.use((0, cors_1.default)({
    origin: 'http://localhost:5173',
    credentials: true
}));
exports.app.use((0, express_session_1.default)({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 30, // 30 นาที (หน่วยเป็นมิลลิวินาที)
        httpOnly: true,
        secure: false
    }
}));
exports.app.use("/api/auth/", routes_auth_1.default);
exports.app.use("/api/", router_user_1.default);
exports.app.use("/api/", router_bag_1.default);
exports.app.use("/api/", router_exam_1.default);
exports.app.use("/api/", router_session_1.default);
exports.app.use("/api/", router_campaign_1.default);
exports.app.use("/api/", router_session_subject_1.default);
exports.app.use("/api/", router_importuser_1.default);
exports.app.use("/api/", router_key_1.default);
exports.app.use("/api/", router_user_session_1.default);
exports.app.use("/api/", router_account_1.accountRouter);
exports.app.use("/api/", router_roles_1.roleRouter);
exports.app.use("/api", router_examroom_1.default);
exports.app.use("/api", router_verify_1.default);
exports.app.get("/test", authentication_1.isAuthenticated, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const conn = DB_1.DB.getInstance();
        const [rows] = yield conn.execute('SELECT * from accounts');
        res.json(rows);
    }
    catch (error) {
        res.status(500).send({ message: error.message });
    }
}));
exports.app.listen(process.env.PORT, () => __awaiter(void 0, void 0, void 0, function* () {
    yield DB_1.DB.testConnection();
    console.log("เซิร์ฟเวอร์เริ่มทำงานที่พอร์ต 8000");
}));
