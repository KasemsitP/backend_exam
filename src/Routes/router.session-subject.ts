
import { Router } from "express";
import { sessionSubjectController } from "../Controller/session-subject.controller";

const sessionSubjectRouter = Router();


sessionSubjectRouter.post(
    "/session-subjects",
    sessionSubjectController.create
);


sessionSubjectRouter.delete(
    "/session-subjects/:sessionId/:subjectId",
    sessionSubjectController.delete
);

export default sessionSubjectRouter;
