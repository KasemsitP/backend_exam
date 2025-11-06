import express, { Express, Request, Response } from 'express';
import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv"
import session from 'express-session';
import {DB} from './model/DB';
import authrouter from "./Routes/routes.auth"
import userrouter from "./Routes/router.user"
import bagRouter from './Routes/router.bag';
import examDataRouter from "./Routes/router.exam"
import sessionRouter from "./Routes/router.session"
import campaignRouter from './Routes/router.campaign';
import seesionsubject from './Routes/router.session-subject';
import importuser from './Routes/router.importuser';
import key from './Routes/router.key';
import usersession from './Routes/router.user-session';
import { accountRouter } from './Routes/router.account';
import { isAuthenticated } from './Middleware/authentication';
import { roleRouter } from './Routes/router.roles';
import examroomRouter from'./Routes/router.examroom';
import verifyRouter from './Routes/router.verify'
dotenv.config()
export const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use(cookieParser());
const allowedOrigins = [
  'http://localhost:5173',               // frontend dev
  'https://exam-management-uyce.onrender.com', // frontend prod
];

app.use(cors({
  origin: function (origin, callback) {
    // ถ้าไม่มี origin (เช่น request จาก Postman) ให้อนุญาต
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true); // อนุญาต origin นี้
    } else {
      callback(new Error('Not allowed by CORS')); // ไม่อนุญาต
    }
  },
  credentials: true
}));
app.use(session({
  secret: "your-secret-key",
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 30, // 30 นาที (หน่วยเป็นมิลลิวินาที)
    httpOnly: true,
  //  secure: false
//  เพิ่มลองดูก่อนว่าได้ไหม
    secure: true,           // dev ไม่มี HTTPS //true  //ต้องเปิด true
    sameSite: 'none'          // ต้อง none 
  }
}));

app.use("/api/auth/",authrouter)
app.use("/api/",userrouter)
app.use("/api/",bagRouter)
app.use("/api/",examDataRouter)
app.use("/api/",sessionRouter)
app.use("/api/",campaignRouter)
app.use("/api/",seesionsubject)
app.use("/api/",importuser)
app.use("/api/",key)
app.use("/api/",usersession)
app.use("/api/", accountRouter);
app.use("/api/", roleRouter);
app.use("/api", examroomRouter)
app.use("/api",verifyRouter)


app.get("/test",isAuthenticated, async (req, res) => {
  try {

    const conn = DB.getInstance();
    const [rows] = await conn.execute('SELECT * from accounts');
    res.json(rows);
  } catch (error : any) {
    res.status(500).send({message: error.message});
  }
});




app.listen(process.env.PORT, async () => {
  await DB.testConnection();
  console.log("เซิร์ฟเวอร์เริ่มทำงานที่พอร์ต 8000");
});
