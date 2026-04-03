
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

sessionSubjectRouter.get(
    "/session-subjects/linked/:campaign_id",
    sessionSubjectController.IsSessionLinkedToSubject
);

export default sessionSubjectRouter;
