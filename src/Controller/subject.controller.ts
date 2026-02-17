import { Request, Response } from "express";
import { SubjectService } from "../Service/subject.service";

export class SubjectController {
  static async getAll(req: Request, res: Response) {
    try {
      const subjects = await SubjectService.getAllSubjects(req);
      res.json(subjects);
    } catch (err) {
      console.error("Error getAll subjects:", err);
      res.status(500).json({ message: "Failed to fetch subjects" });
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const subject = await SubjectService.createSubject(req);
      res.status(201).json(subject);
    } catch (err: any) {
      console.error("Error create subject:", err);
      res
        .status(400)
        .json({ message: err?.message || "Failed to create subject" });
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const subject = await SubjectService.updateSubject(req);
      if (!subject) {
        return res.status(404).json({ message: "Subject not found" });
      }
      res.json(subject);
    } catch (err: any) {
      console.error("Error update subject:", err);
      res
        .status(400)
        .json({ message: err?.message || "Failed to update subject" });
    }
  }

  static async remove(req: Request, res: Response) {
    try {
      await SubjectService.deleteSubject(req);
      res.status(204).send(); // no content
    } catch (err: any) {
      console.error("Error delete subject:", err);
      res
        .status(400)
        .json({ message: err?.message || "Failed to delete subject" });
    }
  }
static async addQuestion(req: Request, res: Response) {
  try {
    const subject = await SubjectService.addQuestion(req);
    res.status(201).json(subject);
  } catch (err: any) {
    console.error("Error add question:", err);
    res.status(400).json({ message: err?.message || "Failed to add question" });
  }
}

static async deleteQuestion(req: Request, res: Response) {
  try {
    const subject = await SubjectService.deleteQuestion(req);
    res.json(subject);
  } catch (err: any) {
    console.error("Error delete question:", err);
    res.status(400).json({ message: err?.message || "Failed to delete question" });
  }
}
static async getSubjectandQuestion(req: Request, res: Response) {
  try {
    if (!req.params.sessionId || !req.params.campaign_id) {
      return res.status(400).json({ message: "Missing sessionId or campaign_id" });
    }
    const subject = await SubjectService.getSubjectandQuestion(Number(req.params.sessionId), Number(req.params.campaign_id));
    res.json(subject);
  } catch (err: any) {
    console.error("Error get subject and question:", err);
    res.status(400).json({ message: err?.message || "Failed to get subject and question" });
  }
}
static async getSubjectQuestionByCamp(req: Request, res: Response) {
  try {
    if (!req.params.campaign_id) {
      return res.status(400).json({ message: "Missing campaign_id" });
    }
    const subject = await SubjectService.getQuestionByCamp(Number(req.params.campaign_id));
    res.json(subject);
  } catch (err: any) {
    console.error("Error get subject and question:", err);
    res.status(400).json({ message: err?.message || "Failed to get subject and question" });
  }
}


}
