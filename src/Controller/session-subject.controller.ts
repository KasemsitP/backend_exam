import { Request, Response } from "express";
import { sessionSubjectService } from "../Service/session-subject.service";
import { CreateSessionSubjectPayload } from "../Repo/session-subject.repo";

export class sessionSubjectController {
  static create = async (req: Request, res: Response) => {
    try {
      const payload: CreateSessionSubjectPayload = req.body;
      payload.session_id = parseInt(payload.session_id as any, 10);
      if (isNaN(payload.session_id)) {
        return res.status(400).send({ message: "Invalid session_id" });
      }
      if (!payload.code || !payload.name) {
        return res
          .status(400)
          .send({ message: "Missing subject code or name" });
      }

      // 3. ส่งให้ Service จัดการ (Find/Create + Link)
      const data = await sessionSubjectService.create(payload);

      // 4. ส่งผลลัพธ์ (ที่ Join แล้ว) กลับไป
      res.status(201).json(data);
    } catch (error: any) {
      if (error.code === "ER_DUP_ENTRY") {
        return res
          .status(409)
          .send({ message: "วิชานี้ถูกเพิ่มในรอบสอบนี้แล้ว" });
      }
      res.status(500).send({ message: error.message });
    }
  };

  static delete = async (req: Request, res: Response) => {
    try {
      const sessionId = parseInt(req.params.sessionId, 10);
      const subjectId = parseInt(req.params.subjectId, 10);

      if (isNaN(sessionId) || isNaN(subjectId)) {
        return res
          .status(400)
          .send({ message: "Invalid Session or Subject ID" });
      }

      await sessionSubjectService.delete(sessionId, subjectId);
      res.status(204).send(); // 204 No Content
    } catch (error: any) {
      res.status(500).send({ message: error.message });
    }
  };
}

