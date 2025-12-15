import { Router } from "express";
import { graderAssignmentController } from "../Controller/grader-assignment.controller";

const graderAssignmentRouter = Router();


graderAssignmentRouter.post(
  "/grader-assignments",
  graderAssignmentController.createBulk
);

export default graderAssignmentRouter;