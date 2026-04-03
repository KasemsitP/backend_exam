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
exports.DB = void 0;
const promise_1 = __importDefault(require("mysql2/promise"));
require("dotenv/config");
class DB {
    constructor() { } // ป้องกันไม่ให้ new ตรงๆ
    static getInstance() {
        if (!DB.instance) {
            // DB.instance = mysql.createPool({
            //   host: "localhost", 
            //   user: "root",
            //   password: "root",
            //   database: "Exam",
            // });
            // DB.instance = mysql.createPool({
            //   host: process.env.host, 
            //   user: process.env.user,
            //   password: process.env.password,
            //   database: process.env.database,
            // });
            // console.log(process.env.host, process.env.user, process.env.password, process.env.database);
            // // สำหรับ production (Render.com)
            // console.log(process.env.DB_HOST, process.env.DB_USER, process.env.DB_PASS, process.env.DB_NAME, process.env.DB_PORT);
            // DB.instance = mysql.createPool({
            //   host: process.env.DB_HOST,    // จะดึงค่า 35.240.222.183 มาอัตโนมัติ
            //   user: process.env.DB_USER,
            //   password: process.env.DB_PASS,
            //   database: process.env.DB_NAME,
            //   port: Number(process.env.DB_PORT) || 3306,
            //   waitForConnections: true,
            //   connectionLimit: 10,
            //   queueLimit: 0
            // });
            DB.instance = promise_1.default.createPool({
                host: "gateway01.ap-southeast-1.prod.aws.tidbcloud.com",
                user: "bjQWWoB3iN7jDv7.root",
                password: "yKIXdDTrXIh0M0T5",
                database: "exam",
                port: 4000,
                ssl: {
                    rejectUnauthorized: true, // ✅ ต้องเป็น object แบบนี้
                },
            });
            console.log("สร้าง MySQL Pool (Singleton) แล้ว");
        }
        return DB.instance;
    }
    static testConnection() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const pool = this.getInstance();
                const connection = yield pool.getConnection();
                yield connection.ping();
                connection.release();
                console.log("เชื่อมต่อ MySQL สำเร็จ");
                return true;
            }
            catch (error) {
                console.error("เชื่อมต่อ MySQL ล้มเหลว:", error);
                return false;
            }
        });
    }
}
exports.DB = DB;
