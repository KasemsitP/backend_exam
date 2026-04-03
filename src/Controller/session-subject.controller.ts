import { Request, Response } from "express";
import { sessionSubjectService } from "../Service/session-subject.service";
import { CreateSessionSubjectPayload , FindnumQuestion } from "../Repo/session-subject.repo";

export class sessionSubjectController {
  static create = async (req: Request, res: Response) => {
    try {
      const sessionId = parseInt(req.body.session_id, 10);
      const subjectId = parseInt(req.body.subject_id, 10);


      if (isNaN(sessionId) || isNaN(subjectId)) {
        return res.status(400).send({ message: "Invalid session_id or subject_id" });
      }

      const payload: CreateSessionSubjectPayload = {
        session_id: sessionId,
        subject_id: subjectId,
        start_at: req.body.start_at,                 
        end_at: req.body.end_at,                   
        question_count: Number(req.body.question_count),
        question_range: req.body.question_range,
        order_no: req.body.order_no,
      };

      const data = await sessionSubjectService.create(payload);
      return res.status(201).json(data);
    } catch (error: any) {
      if (error.code === "ER_DUP_ENTRY") {
        return res
          .status(409)
          .send({ message: "วิชานี้ถูกเพิ่มในรอบสอบนี้แล้ว" });
      }
      return res.status(500).send({ message: error.message });
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
      return res.status(204).send();
    } catch (error: any) {
      return res.status(500).send({ message: error.message });
    }
  };

  static IsSessionLinkedToSubject = async (req: Request, res: Response) => {
      const {campaign_id} = req.params;
      try {
          const isLinked = await sessionSubjectService.IsLinkedToSession(Number(campaign_id));
          return res.status(200).json({ success: true, isLinked });
      } catch (error: any) {
          return res.status(500).send({ message: error.message });
      }
  }
}

