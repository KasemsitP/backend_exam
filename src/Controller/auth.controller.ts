import { Request, Response } from "express"
import { authservice } from "../Service/auth.service";
import { utills } from "../utills/utills";
import { DB } from "../model/DB";
import authrepo from "../Repo/auth.repo";
import graderRepo from "../Repo/grader.repo";

declare module "express-session" {
  interface SessionData {
    userId?: number;
    sessionVersion?: number;
    roles?: string[];
  }
}

export class authcontroller {
  static register = async (req: Request, res: Response) => {
    const conn = await DB.getInstance().getConnection();

    try {
      const { username, password, full_name, email, role, campaignId } = req.body;

      await conn.beginTransaction();

      await authservice.IsDuplicate(username);

      const roleExists = await authrepo.checkRole(role);
      if (!roleExists) throw new Error("ไม่พบ role ที่ระบุ");

      const isGrader = roleExists.code === "GRADER";

      const hash = await utills.hash(password);

      const userData = { username, password: hash, full_name, email, role };
      const insertId = await authrepo.createAccount(userData);
      const accountId = insertId;

      if (!accountId) throw new Error("สร้างบัญชีไม่สำเร็จ");
      console.log(accountId)
      console.log(isGrader, campaignId)

      if (isGrader && campaignId) {
        await graderRepo.create(
          {
            account_id: accountId,
            campaign_id: Number(campaignId),
          },
          conn
        );
      }

      await conn.commit();

      return res.status(201).json({ message: "ลงทะเบียนสำเร็จ", id: accountId });
    } catch (error: any) {
      await conn.rollback();
      return res
        .status(400)
        .json({ message: error.message ?? "register failed" });
    } finally {
      conn.release();
    }
  };


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


  static login = async (req: Request, res: Response) => {
    const { username, password } = req.body;

    try {
      const result = await authservice.CheckUsername(username, password);

      if (Number(result.active) !== 1) {
        throw new Error("บัญชีถูกระงับการใช้งาน");
      }
      const userId = Number(result.id);
      const conn = DB.getInstance();

      //  ลบ session เก่าทั้งหมดของ user (บังคับเครื่องเดียว)
await conn.execute(
        "DELETE FROM auth_sessions WHERE account_id = ?",
        [userId]
      );

      // 2. regenerate session ใหม่
      await new Promise<void>((resolve, reject) => {
        req.session.regenerate((err) => (err ? reject(err) : resolve()));
      });

      // 3. set session ใหม่
      req.session.userId = userId;
      req.session.sessionVersion = Number(result.sessionVersion);
      req.session.roles = result.roles;

      // 4. save session แบบให้ชัวร์ว่าเซฟเสร็จ
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) return reject(err);
          resolve();
        });
      });

      // 5. ผูก sid ใหม่กับ account_id (ต้องทำหลังเซฟเสร็จชัวร์ๆ)
      // เพิ่ม try/catch ป้องกันจังหวะที่เซฟเสร็จแต่มองไม่เห็นใน DB ทันที
      try {
         await authrepo.updateAuthsession(userId, req.sessionID);
      } catch(dbErr) {
         console.error("Failed to map account_id to session:", dbErr);
         // ไม่ต้อง throw error ปล่อยให้ login ผ่านไปก่อน
      }

      return res.status(200).json({
        message: "เข้าสู่ระบบสำเร็จ",
        user: result,
      });

    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  };
  static getMe = async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(401).json({ message: "ไม่ได้รับอนุญาต" });

      // ดึงข้อมูลสดจาก DB (รวม roles)
      const row = await authrepo.findMeById(userId);
      if (!row) return res.status(401).json({ message: "ไม่ได้รับอนุญาต" });

      // กัน user โดน revoke
      if (Number(row.active) !== 1) {
        req.session.destroy(() => { });
        return res.status(403).json({ message: "บัญชีถูกระงับการใช้งาน" });
      }

      const roleCode = (row.role_code || "staff").toLowerCase();

      return res.status(200).json({
        id: String(row.id),
        name: row.full_name,
        username: row.username,
        roles: [roleCode],
      });
    } catch (e: any) {
      return res.status(500).json({ message: e.message });
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
  static getAllGraders = async (req: Request, res: Response) => {
    const campaign_id = parseInt(req.params.id, 10)
    try {
      const accounts = await authservice.getAllGradersAccounts(Number(campaign_id));
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
      console.log("Deleting account id:", req.params.id);

      const id = parseInt(req.params.id, 10);
      await authservice.deleteAccount(id);
      res.status(200).json({ id: id });
    } catch (error: any) {
      res.status(500).send({ message: error.message });
    }
  }

  static revokeAccount = async (req: Request, res: Response) => {
    try {
      const targetId = Number(req.params.id);
      if (Number.isNaN(targetId)) {
        return res.status(400).json({ message: "Invalid account id" });
      }

      // actor id (คนที่กด revoke) ถ้าคุณเก็บใน session
      const actorId = req.session.userId;

      const result = await authservice.revokeAccount(targetId, actorId);
      return res.status(200).json({ message: "revoked", ...result });
    } catch (e: any) {
      return res.status(400).json({ message: e.message });
    }
  };

  static unrevokeAccount = async (req: Request, res: Response) => {
    try {
      const targetId = Number(req.params.id);
      if (Number.isNaN(targetId)) {
        return res.status(400).json({ message: "Invalid account id" });
      }

      const result = await authservice.unrevokeAccount(targetId);
      return res.status(200).json({ message: "unrevoked", ...result });
    } catch (e: any) {
      return res.status(400).json({ message: e.message });
    }
  };


}
