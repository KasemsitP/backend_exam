import { Request, Response } from "express"
import { authservice } from "../Service/auth.service";
import { utills } from "../utills/utills";
import authrepo from "../Repo/auth.repo";

declare module "express-session" {
    interface SessionData {
        userId?: number;
        userData?: any;
    }
}

export class authcontroller {
    static register = async (req: Request, res: Response) => {
        try {  //full name not null , role
            const { username, password, full_name, email, role } = req.body;
            await authservice.IsDuplicate(username)
            const hash = await utills.hash(password)
            const userData = { username, password: hash, full_name, email, role };
            const result = await authrepo.createAccount(userData)
            res.status(201).send({ message: "ลงทะเบียนสำเร็จ" });

        } catch (error: any) {
            return res.status(400).send({ message: error.message });
        }
    }
    static login = async (req: Request, res: Response) => {
        const { username, password } = req.body;
        try {
            const result = await authservice.CheckUsername(username, password)
            req.session.userId = result.id
            req.session.userData = result
            res.status(201).send({ message: "เข้าสู่ระบบสำเร็จ" });
        } catch (error: any) {
            return res.status(400).send({ message: error.message });
        }
    }
static getMe = (req: Request, res: Response) => {
        if (req.session.userData) {
            res.status(200).json(req.session.userData);
        } else {
            res.status(401).send({ message: "Not authenticated" });
        }
    }
    static logout = (req: Request, res: Response) => {
        req.session.destroy(err => {
            if (err) {
                return res.status(500).send({ message: "ออกจากระบบไม่สำเร็จ" });
            }
            res.clearCookie("connect.sid"); 
            res.send({ message: "ออกจากระบบเรียบร้อยแล้ว" });
        });
    };


}
