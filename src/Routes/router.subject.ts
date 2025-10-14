import express from "express";
import { isAuthenticated } from "../Middleware/authentication";
import { subjectcontroller } from "../Controller/subject.controller";
const router = express.Router();

router.get("/subjectByCampaign",subjectcontroller.getSubject)
router.post("/insertBySessionSubject",subjectcontroller.insertBySession)

export default router;




