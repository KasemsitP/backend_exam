import { Request, Response } from "express";
import { sessionService } from "../Service/session.service";
import { ApiSession, CreateSessionPayload } from "../Repo/session.repo";

export class sessionController {
  
  static create = async (req: Request, res: Response) => {
    try {
      const payload: CreateSessionPayload = req.body;
      const newSession = await sessionService.create(payload);
      

      res.status(201).json(newSession);

    } catch (error: any) {
      res.status(400).send({ message: error.message });
    }
  };

    static update = async (req: Request, res: Response) => {
    try {
      const {exam_date} = req.body;
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).send({ message: "Invalid ID format" });
      }
      console.log(exam_date, id)
      const newSession = await sessionService.update(exam_date, id);
    
      res.status(201).json(newSession);

    } catch (error: any) {
      res.status(400).send({ message: error.message });
    }
  };

  static delete = async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).send({ message: "Invalid ID format" });
      }
      console.log(id)
      await sessionService.delete(id);
      
      res.status(204).send();

    } catch (error: any) {
      res.status(400).send({ message: error.message });
    }
  };
}
