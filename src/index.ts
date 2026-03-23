import path from 'path';
import express, { Express, Request, Response } from 'express';
import "dotenv/config";
import fs from 'fs';
import cookieParser from "cookie-parser";
import cors from "cors";
import compression from "compression";
import dotenv from "dotenv"
import MySQLStoreFactory from "express-mysql-session";
import session from 'express-session';
import { Logging } from './Middleware/logging';
import { DB } from './model/DB';
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
import examroomRouter from './Routes/router.examroom';
import verifyRouter from './Routes/router.verify'
import bagHandover from './Routes/router.baghandover';
import graderRouter from './Routes/router.grader';
import gradingslotRouter from './Routes/router.gradingslot';
import gradingscoreRouter from './Routes/router.gradingscore';
import subjectRouter from './Routes/router.subject'
import graderAssignmentRouter from './Routes/router.grader-assignment'
import gradingSummaryRouter from './Routes/router.gradingsummary';
import gradingReportRouter from './Routes/router.gradingreport'
import seatRouter from './Routes/router.seat'
import dashboardRouter from './Routes/router.dashboard'
import signsheetRouter from './Routes/router.signsheet'
import seatplanRouter from './Routes/router.seatplan'
import decryptRouter from './Routes/router.decrypt'
import gradingrecheck from './Routes/router.graderrecheck'
import settingsRouter from './Routes/router.settings';

dotenv.config()
export const app = express();
app.set('trust proxy', 1);
app.use(
  compression({
    threshold: 1024, //  บีบทุกอย่างทันที (เอาไว้เทสก่อน)
  })
);
app.disable("x-powered-by");
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(Logging);
// const allowedOrigins = [
//   'http://localhost:5173',               // frontend dev

//   'http://192.168.1.39:5173',
//   'https://exam-management-uyce.onrender.com', // frontend prod
// ];

const isProduction = process.env.NODE_ENV === "production";

if (!isProduction) {
  app.use(
    cors({
      origin: ["http://localhost:5173", "http://192.168.1.39:5173"],
      credentials: true,
    })
  );
}


const MySQLStore = MySQLStoreFactory(session);

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
// const sessionStore = new MySQLStore({
//   host: process.env.DB_HOST,
//   user: process.env.DB_USER,
//   password: process.env.DB_PASS,
//   database: process.env.DB_NAME,
//   port: Number(process.env.DB_PORT) || 3306,
//   schema: {
//     tableName: "auth_sessions",
//     columnNames: {
//       session_id: "sid",
//       expires: "expires",
//       data: "data",
//     },
//   },
// });


const sessionStore = new MySQLStore({
  host: isProduction ? process.env.DB_HOST : process.env.host,
  user: isProduction ? process.env.DB_USER : process.env.user,
  password: isProduction ? process.env.DB_PASS : process.env.password,
  database: isProduction ? process.env.DB_NAME : process.env.database,
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

//prod

// app.use(
//   session({
//     name: "sid",
//     secret: process.env.SESSION_SECRET || "dev-secret",
//     resave: false,
//     saveUninitialized: false,
//     store: sessionStore,
//     rolling: false,
//     cookie: {
//       httpOnly: true,
//       // ถ้าอยู่บน Render (HTTPS) จะเป็น true, ถ้าเทสต์เครื่องตัวเอง (HTTP) จะเป็น false
//       secure: isProduction,
//       // อยู่โดเมนเดียวกันแล้ว ใช้ lax ได้เลย (แถมปลอดภัยกว่าด้วย)
//       sameSite: "lax",
//       maxAge: 1000 * 60 * 30,
//     },
//   })
// );

app.use(
  session({
    name: "sid",
    secret: process.env.SESSION_SECRET || "dev-secret",
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    rolling: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite:
        process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 1000 * 60 * 60,
    },
  })
);

app.use((req, res, next) => {
  console.log("Session:", req.session);
  next();
});

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

app.get("/big-test", (req, res) => {
  const bigData = Array(10000).fill({ name: "test", value: "1234567890" });
  res.json(bigData);
});
app.use("/api/auth/", authrouter)
app.use("/api", isAuthenticated);
app.use("/api/", userrouter)
app.use("/api/", bagRouter)
app.use("/api/", examDataRouter)
app.use("/api/", sessionRouter)
app.use("/api/", campaignRouter)
app.use("/api/", seesionsubject)
app.use("/api/", importuser)
app.use("/api/", key)
app.use("/api/", usersession)
app.use("/api/", accountRouter);
app.use("/api", subjectRouter)
app.use("/api/", roleRouter);
app.use("/api", examroomRouter)
app.use("/api", verifyRouter)
app.use("/api", bagHandover)
app.use("/api/", graderRouter)
app.use("/api/", gradingslotRouter)
app.use("/api/", gradingscoreRouter)
app.use("/api", graderAssignmentRouter)
app.use("/api", gradingSummaryRouter)
app.use("/api", gradingReportRouter)
app.use("/api", seatRouter)
app.use("/api", dashboardRouter)
app.use("/api", signsheetRouter)
app.use("/api", seatplanRouter)
app.use("/api", decryptRouter)
app.use("/api", gradingrecheck)
app.use("/api/", settingsRouter);

app.get("/test", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const conn = DB.getInstance();
    // จุดที่ 3: เติม as any ให้ conn ถ้าระบบหา Type ของ execute ไม่เจอ
    const [rows] = await (conn as any).execute('SELECT * from accounts');
    res.json(rows);
  } catch (error: any) {
    res.status(500).send({ message: error.message });
  }
});
const frontendPath = path.join(process.cwd(), "client-dist");
console.log("👉 frontendPath:", frontendPath, "exists:", fs.existsSync(frontendPath));

// เสิร์ฟไฟล์ static: /assets/...
// app.use(express.static(frontendPath, { index: false }));


// // SPA fallback (กัน /api และ /assets ไม่ให้โดนส่ง index.html)
// app.get(/^\/(?!api\/|assets\/).*/, (req: Request, res: Response) => {
//   res.sendFile(path.join(frontendPath, "index.html"));
// });
//prod
app.use(
  express.static(frontendPath, {
    index: false,
    maxAge: "1y",
    immutable: true,
    setHeaders: (res, filePath) => {
      // กัน index.html ติด cache 1 ปี (เผื่อมีคนเรียกตรงๆ)
      if (filePath.endsWith("index.html")) {
        res.setHeader("Cache-Control", "no-cache");
      }
    },
  })
);

// SPA fallback (กัน /api และ /assets ไม่ให้โดนส่ง index.html)
app.get(/^\/(?!api\/)(?!.*\.[a-zA-Z0-9]+$).*/, (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-cache");
  res.sendFile(path.join(frontendPath, "index.html"));
});

app.listen(process.env.PORT, async () => {
  await DB.testConnection();
  console.log(`เซิร์ฟเวอร์รันที่พอร์ต ${process.env.PORT}`);
});