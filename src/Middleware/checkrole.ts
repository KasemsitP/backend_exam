import { Request, Response, NextFunction } from "express";
export function checkRole(requiredRole: string) {
  return (req: Request, res: Response, next: NextFunction) => {
   const userRole = req.session.roles?.[0];

    if (!userRole) {
      return res.status(401).send({ message: "ไม่มีสิทธิ์" });
    }

    if (userRole !== requiredRole) {
      return res.status(403).send({ message: "ไม่อนุญาต: สิทธิ์ไม่เพียงพอ" });
    }

    next();
  }
}
