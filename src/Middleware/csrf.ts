import { doubleCsrf } from "csrf-csrf";
import type { Request } from "express";

export const {
  generateCsrfToken,      // ✅ ชื่อนี้
  doubleCsrfProtection,
} = doubleCsrf({
  getSecret: () => process.env.csrf_secret!,
  getSessionIdentifier: (req: Request) => req.sessionID,
  cookieName: "csrf-token",
  cookieOptions: {
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  },
  size: 64,
});