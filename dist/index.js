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
const path_1 = __importDefault(require("path"));
const express_1 = __importDefault(require("express"));
require("dotenv/config");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const cors_1 = __importDefault(require("cors"));
const compression_1 = __importDefault(require("compression"));
const dotenv_1 = __importDefault(require("dotenv"));
const express_mysql_session_1 = __importDefault(require("express-mysql-session"));
const express_session_1 = __importDefault(require("express-session"));
const logging_1 = require("./Middleware/logging");
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
const router_baghandover_1 = __importDefault(require("./Routes/router.baghandover"));
const router_grader_1 = __importDefault(require("./Routes/router.grader"));
const router_gradingslot_1 = __importDefault(require("./Routes/router.gradingslot"));
const router_gradingscore_1 = __importDefault(require("./Routes/router.gradingscore"));
const router_subject_1 = __importDefault(require("./Routes/router.subject"));
const router_grader_assignment_1 = __importDefault(require("./Routes/router.grader-assignment"));
const router_gradingsummary_1 = __importDefault(require("./Routes/router.gradingsummary"));
const router_gradingreport_1 = __importDefault(require("./Routes/router.gradingreport"));
const router_seat_1 = __importDefault(require("./Routes/router.seat"));
const router_dashboard_1 = __importDefault(require("./Routes/router.dashboard"));
const router_signsheet_1 = __importDefault(require("./Routes/router.signsheet"));
const router_seatplan_1 = __importDefault(require("./Routes/router.seatplan"));
const router_decrypt_1 = __importDefault(require("./Routes/router.decrypt"));
const router_graderrecheck_1 = __importDefault(require("./Routes/router.graderrecheck"));
const router_settings_1 = __importDefault(require("./Routes/router.settings"));
dotenv_1.default.config();
exports.app = (0, express_1.default)();
exports.app.set('trust proxy', 1);
exports.app.use((0, compression_1.default)()); // ✅ ใส่ตรงนี้
exports.app.use(express_1.default.json({ limit: "10mb" }));
exports.app.use(express_1.default.urlencoded({ extended: true, limit: "10mb" }));
exports.app.use((0, cookie_parser_1.default)(process.env.COOKIE_SECRET));
exports.app.use(logging_1.Logging);
const allowedOrigins = [
    'http://localhost:5173', // frontend dev
    'http://192.168.1.39:5173',
    'https://exam-management-uyce.onrender.com', // frontend prod
];
exports.app.use((0, cors_1.default)({
    origin: function (origin, callback) {
        if (!origin)
            return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
const MySQLStore = (0, express_mysql_session_1.default)(express_session_1.default);
//dev
// const sessionStore = new MySQLStore({
//         host: process.env.host, 
//         user: process.env.user,
//         password: process.env.password,
//         database: process.env.database,
//   schema: {
//     tableName: "auth_sessions",
//     columnNames: {
//       session_id: "sid",
//       expires: "expires",
//       data: "data",
//     },
//   },
// });
//prod
const sessionStore = new MySQLStore({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT) || 3306,
    schema: {
        tableName: "auth_sessions",
        columnNames: {
            session_id: "sid",
            expires: "expires",
            data: "data",
        },
    },
});
//dev
// app.use(
//   session({
//     name: "sid",
//     secret: process.env.SESSION_SECRET || "dev-secret",
//     resave: false,
//     saveUninitialized: false,
//     store: sessionStore,
//     cookie: {
//       httpOnly: true,
//       secure: process.env.NODE_ENV === "production",
//       maxAge: 1000 * 60 * 60, // 1 ชม.
//     },
//   })
// );
//prod
const isProduction = process.env.NODE_ENV === "production";
exports.app.use((0, express_session_1.default)({
    name: "sid",
    secret: process.env.SESSION_SECRET || "dev-secret",
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
        httpOnly: true,
        // ถ้าอยู่บน Render (HTTPS) จะเป็น true, ถ้าเทสต์เครื่องตัวเอง (HTTP) จะเป็น false
        secure: isProduction,
        // อยู่โดเมนเดียวกันแล้ว ใช้ lax ได้เลย (แถมปลอดภัยกว่าด้วย)
        sameSite: "lax",
        maxAge: 1000 * 60 * 60,
    },
}));
// app.use(session({
//   secret: "your-secret-key",
//   resave: false,
//   saveUninitialized: false,
//   cookie: {
//     maxAge: 1000 * 60 * 30, // 30 นาที (หน่วยเป็นมิลลิวินาที)
//     httpOnly: true,
//     secure: false
// //  เพิ่มลองดูก่อนว่าได้ไหม
//     // secure: true,           // dev ไม่มี HTTPS //true  //ต้องเปิด true
//     // sameSite: 'none'          // ต้อง none 
//   }
// }));
// const CSRF_SECRET =
//   process.env.CSRF_SECRET || "12345678901234567890123456789012"; // 32 ตัวขึ้นไป
// app.use(csrf(CSRF_SECRET, ["POST", "PUT", "PATCH", "DELETE"]));
// app.get("/api/csrf-token", (req: Request, res: Response) => {
//   const token = (req as any).csrfToken();
//   res.json({ csrfToken: token });
// });
exports.app.use("/api/auth/", routes_auth_1.default);
// app.use(isAuthenticated)
exports.app.use("/api/", authentication_1.isAuthenticated); // <--- แก้ตรงนี้ครับ
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
exports.app.use("/api", router_subject_1.default);
exports.app.use("/api/", router_roles_1.roleRouter);
exports.app.use("/api", router_examroom_1.default);
exports.app.use("/api", router_verify_1.default);
exports.app.use("/api", router_baghandover_1.default);
exports.app.use("/api/", router_grader_1.default);
exports.app.use("/api/", router_gradingslot_1.default);
exports.app.use("/api/", router_gradingscore_1.default);
exports.app.use("/api", router_grader_assignment_1.default);
exports.app.use("/api", router_gradingsummary_1.default);
exports.app.use("/api", router_gradingreport_1.default);
exports.app.use("/api", router_seat_1.default);
exports.app.use("/api", router_dashboard_1.default);
exports.app.use("/api", router_signsheet_1.default);
exports.app.use("/api", router_seatplan_1.default);
exports.app.use("/api", router_decrypt_1.default);
exports.app.use("/api", router_graderrecheck_1.default);
exports.app.use("/api/", router_settings_1.default);
exports.app.get("/test", authentication_1.isAuthenticated, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const conn = DB_1.DB.getInstance();
        // จุดที่ 3: เติม as any ให้ conn ถ้าระบบหา Type ของ execute ไม่เจอ
        const [rows] = yield conn.execute('SELECT * from accounts');
        res.json(rows);
    }
    catch (error) {
        res.status(500).send({ message: error.message });
    }
}));
// 🚨 แก้จุดที่ 1: เปลี่ยนมาใช้ __dirname และ '../client-dist'
exports.app.use(express_1.default.static(path_1.default.join(__dirname, '../client-dist')));
// 🚨 แก้จุดที่ 2: เปลี่ยนมาใช้ __dirname และ '../client-dist'
exports.app.get(/.*/, (req, res) => {
    res.sendFile(path_1.default.join(__dirname, '../client-dist', 'index.html'));
});
exports.app.listen(process.env.PORT, () => __awaiter(void 0, void 0, void 0, function* () {
    yield DB_1.DB.testConnection();
    console.log("เซิร์ฟเวอร์เริ่มทำงานที่พอร์ต 8000");
}));
