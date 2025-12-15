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
      res.status(201).send({ message: "ลงทะเบียนสำเร็จ" , id:result });

    } catch (error: any) {
      return res.status(400).send({ message: error.message });
    }
  }
  static login = async (req: Request, res: Response) => {
    const { username, password } = req.body;
    try {
      const result = await authservice.CheckUsername(username, password)
      req.session.userId = Number(result.id);
      req.session.userData = result;


      // console.log(result.id , req.sessionID)
      // const resUpdate = await authrepo.updateAuthsession(result.id , req.sessionID)
      // console.log(resUpdate)
      // res.status(200).json({
      //   message: "เข้าสู่ระบบสำเร็จ",
      //   user: result,
      // });
      try {
        await new Promise<void>((resolve, reject) => {
          req.session.save((err) => {
            if (err) return reject(err);
            resolve();
          });
        });

        console.log("login sid =", req.sessionID, "userId =", result.id);

        // อัปเดต account_id ใน auth_sessions
        await authrepo.updateAuthsession(result.id, req.sessionID);
      } catch (err) {
        console.error("Session or auth_sessions update failed:", err);
        // ตรงนี้เลือกได้ว่าจะให้ login ผ่านอยู่ดี หรือจะ response 500
        // ถ้าอยากให้ล็อกอินได้ต่อแม้ updateAuthsession fail:
        // ไม่ต้อง throw ต่อ
      }

      return res.status(200).json({
        message: "เข้าสู่ระบบสำเร็จ",
        user: result,
      });

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
  static getAll = async (req: Request, res: Response) => {
    try {
      const accounts = await authservice.getAllAccounts();
      res.status(200).json(accounts);
    } catch (error: any) {
      res.status(500).send({ message: error.message });
    }
  }

  static getRoles = async (req: Request, res: Response) => {
    try {
      const roles = await authservice.getAllRoles();
      res.status(200).json(roles);
    } catch (error: any) {
      res.status(500).send({ message: error.message });
    }
  }

  static update = async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const data = req.body;
      const updatedAccount = await authservice.updateAccount(id, data);
      res.status(200).json(updatedAccount);
    } catch (error: any) {
      res.status(500).send({ message: error.message });
    }
  }

  static delete = async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      await authservice.deleteAccount(id);
      res.status(200).json({ id: id });
    } catch (error: any) {
      res.status(500).send({ message: error.message });
    }
  }


}
