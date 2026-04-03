"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionSubjectController = void 0;
const session_subject_service_1 = require("../Service/session-subject.service");
class sessionSubjectController {
}
exports.sessionSubjectController = sessionSubjectController;
_a = sessionSubjectController;
sessionSubjectController.create = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const sessionId = parseInt(req.body.session_id, 10);
        const subjectId = parseInt(req.body.subject_id, 10);
        if (isNaN(sessionId) || isNaN(subjectId)) {
            return res.status(400).send({ message: "Invalid session_id or subject_id" });
        }
        const payload = {
            session_id: sessionId,
            subject_id: subjectId,
            start_at: req.body.start_at,
            end_at: req.body.end_at,
            question_count: Number(req.body.question_count),
            question_range: req.body.question_range,
            order_no: req.body.order_no,
        };
        const data = yield session_subject_service_1.sessionSubjectService.create(payload);
        return res.status(201).json(data);
    }
    catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            return res
                .status(409)
                .send({ message: "วิชานี้ถูกเพิ่มในรอบสอบนี้แล้ว" });
        }
        return res.status(500).send({ message: error.message });
    }
});
sessionSubjectController.delete = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const sessionId = parseInt(req.params.sessionId, 10);
        const subjectId = parseInt(req.params.subjectId, 10);
        if (isNaN(sessionId) || isNaN(subjectId)) {
            return res
                .status(400)
                .send({ message: "Invalid Session or Subject ID" });
        }
        yield session_subject_service_1.sessionSubjectService.delete(sessionId, subjectId);
        return res.status(204).send();
    }
    catch (error) {
        return res.status(500).send({ message: error.message });
    }
});
sessionSubjectController.IsSessionLinkedToSubject = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { campaign_id } = req.params;
    try {
        const isLinked = yield session_subject_service_1.sessionSubjectService.IsLinkedToSession(Number(campaign_id));
        return res.status(200).json({ success: true, isLinked });
    }
    catch (error) {
        return res.status(500).send({ message: error.message });
    }
});
