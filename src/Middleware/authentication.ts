import { Request, Response, NextFunction } from "express";

export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.session.userId) {
    next(); 
  } else {
    res.status(401).send({ message: "ไม่มีสิทธิ์ กรุณาเข้าสู่ระบบก่อน" });
  }
}
