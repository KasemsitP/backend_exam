import { Request, Response, NextFunction } from "express";
import { DB } from "../model/DB";

// Middleware/authentication.ts

export async function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ message: "unauthenticated" });

    const conn = DB.getInstance();
    const [rows]: any = await conn.execute(
      "SELECT id, active, session_version FROM accounts WHERE id = ? LIMIT 1",
      [userId]
    );

    const user = rows?.[0];
    if (!user) {
      // ❌ เอา req.session.destroy() ออก
      return res.status(401).json({ message: "unauthenticated" });
    }

    // ถูก revoke/disable
    if (Number(user.active) !== 1) {
      // ❌ เอา req.session.destroy() ออก
      return res.status(403).json({ message: "account revoked/disabled" });
    }

    // session เก่า (โดน bump session_version)
    const dbVer = Number(user.session_version ?? 1);
    const sessVer = Number(req.session.sessionVersion ?? 0);
    if (dbVer !== sessVer) {
      // ❌ เอา req.session.destroy() ออก
      return res.status(401).json({ message: "session revoked" });
    }

    return next();
  } catch (err) {
    return res.status(500).json({ message: "isAuthenticated error" });
  }
}