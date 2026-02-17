import { Router } from "express";
import { SubjectController } from "../Controller/subject.controller";

const subjectRouter = Router();

subjectRouter.get("/subjects", SubjectController.getAll);
subjectRouter.get("/subjects/questioncamp/:campaign_id", SubjectController.getSubjectQuestionByCamp);
subjectRouter.get("/subjects/:sessionId/:campaign_id", SubjectController.getSubjectandQuestion);
subjectRouter.post("/subjects", SubjectController.create);
subjectRouter.put("/subjects/:id", SubjectController.update);
subjectRouter.delete("/subjects/:id", SubjectController.remove);
subjectRouter.post("/subjects/:id/questions", SubjectController.addQuestion);
subjectRouter.delete(
    "/subjects/:id/questions/:questionId",
    SubjectController.deleteQuestion
);

export default subjectRouter;
