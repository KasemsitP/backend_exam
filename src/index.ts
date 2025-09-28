import express, { Express, Request, Response } from 'express';
import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv"
import session from 'express-session';
import {DB} from './model/DB';
import authrouter from "./Routes/routes.auth"
import { isAuthenticated } from './Middleware/authentication';
dotenv.config()
export const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(cors());
app.use(session({
  secret: "your-secret-key",
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 30, // 30 นาที (หน่วยเป็นมิลลิวินาที)
    httpOnly: true,
    secure: false
  }
}));

app.use("/api/auth/",authrouter)


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
  console.log("Server started at port 8000");
});