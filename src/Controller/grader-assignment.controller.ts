// src/Controller/grader-assignment.controller.ts
import { Request, Response } from "express";
import { graderAssignmentService, CreateGraderAssignmentInput } from "../Service/grader-assignment.service";

export class graderAssignmentController {
  static createBulk = async (req: Request, res: Response) => {
    try {
      const { assignments } = req.body as {
        assignments?: CreateGraderAssignmentInput[];
      };

      if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
        return res
          .status(400)
          .send({ message: "assignments ต้องเป็น array และห้ามว่าง" });
      }

      await graderAssignmentService.createBulk(assignments);

      res.status(201).send({
        message: "สร้างการมอบหมายผู้ตรวจเรียบร้อย",
        count: assignments.length,
      });
    } catch (error: any) {
      console.error("Controller Error (graderAssignmentController.createBulk):", error);
      res
        .status(500)
        .send({ message: error?.message ?? "Failed to create grader assignments" });
    }
  };
}
