import { Request, Response, NextFunction } from "express";
export function checkRole(requiredRole: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.session.userData?.role; // สมมติเก็บ role ไว้ใน session

    if (!userRole) {
      return res.status(401).send({ message: "Unauthorized" });
    }

    if (userRole !== requiredRole) {
      return res.status(403).send({ message: "Forbidden: Insufficient role" });
    }

    next();
  }
}
