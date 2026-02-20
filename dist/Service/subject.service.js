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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubjectService = void 0;
const DB_1 = require("../model/DB");
const subject_repo_1 = __importDefault(require("../Repo/subject.repo"));
class SubjectService {
}
exports.SubjectService = SubjectService;
_a = SubjectService;
SubjectService.getAllSubjects = (_req) => __awaiter(void 0, void 0, void 0, function* () {
    return subject_repo_1.default.getSubjectsWithQuestions();
});
SubjectService.getQuestionByCamp = (campaignId) => __awaiter(void 0, void 0, void 0, function* () {
    return subject_repo_1.default.getQuestionByCamp(campaignId);
});
SubjectService.createSubject = (req) => __awaiter(void 0, void 0, void 0, function* () {
    const { code, name, questions } = req.body;
    if (!code || !name) {
        throw new Error("code and name are required");
    }
    return subject_repo_1.default.createSubjectWithQuestions({
        code: code.trim(),
        name: name.trim(),
        questions: Array.isArray(questions) ? questions : [],
    });
});
SubjectService.updateSubject = (req) => __awaiter(void 0, void 0, void 0, function* () {
    const id = Number(req.params.id);
    const { code, name, questions } = req.body;
    if (!id || Number.isNaN(id)) {
        throw new Error("Invalid subject id");
    }
    return subject_repo_1.default.updateSubject({
        id,
        code: code.trim(),
        name: name.trim(),
        questions: Array.isArray(questions) ? questions : undefined,
    });
});
SubjectService.deleteSubject = (req) => __awaiter(void 0, void 0, void 0, function* () {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) {
        throw new Error("Invalid subject id");
    }
    yield subject_repo_1.default.deleteSubject(id);
});
SubjectService.addQuestion = (req) => __awaiter(void 0, void 0, void 0, function* () {
    const subjectId = Number(req.params.id);
    const { label, questionNo, maxScore } = req.body;
    if (!maxScore) {
        throw new Error("กรุณาใส่คะแนนเต็ม");
    }
    if (!label || !label.trim()) {
        throw new Error("ชื่อหัวข้อไม่สามารถเว้นว่างได้");
    }
    if (!subjectId || Number.isNaN(subjectId)) {
        throw new Error("รหัสวิชาไม่ถูกต้อง");
    }
    const conn = yield DB_1.DB.getInstance().getConnection();
    try {
        yield conn.beginTransaction();
        const targetNo = questionNo ? Number(questionNo) : undefined;
        const fullScore = yield subject_repo_1.default.getMaxScoreById(subjectId, conn);
        const addedScore = Number(maxScore);
        if (!fullScore) {
            throw new Error("ไม่เจอคะแนนเต็มข้อวิชา");
        }
        const currentScore = fullScore.full_score;
        if (currentScore + addedScore > 100) {
            throw new Error("คะแนนรวมของหัวข้อทั้งหมดต้องไม่เกิน 100");
        }
        const result = yield subject_repo_1.default.addQuestion(subjectId, label.trim(), Number(maxScore), targetNo, conn);
        yield subject_repo_1.default.updateMaxScore(subjectId, addedScore, conn);
        yield conn.commit();
        return result;
    }
    catch (error) {
        yield conn.rollback();
        throw error;
    }
    finally {
        conn.release();
    }
});
SubjectService.deleteQuestion = (req) => __awaiter(void 0, void 0, void 0, function* () {
    const subjectId = Number(req.params.id);
    const questionId = Number(req.params.questionId);
    if (!subjectId || Number.isNaN(subjectId) ||
        !questionId || Number.isNaN(questionId)) {
        throw new Error("ไม่พบรหัสวิชาที่ต้องการลบ");
    }
    const conn = yield DB_1.DB.getInstance().getConnection();
    try {
        yield conn.beginTransaction();
        // ดึงคะแนนของข้อที่จะลบ (lock แถว)
        const question = yield subject_repo_1.default.getQuestionById(subjectId, questionId, conn);
        if (!question) {
            throw new Error("ไม่พบหัวข้อที่ต้องการลบ");
        }
        const removedScore = question.maxScore;
        // ลบข้อสอบ
        yield subject_repo_1.default.deleteQuestion(subjectId, questionId, conn);
        // ลบคะแนนออกจาก subject แบบ atomic
        yield subject_repo_1.default.decreaseFullScore(subjectId, removedScore, conn);
        yield conn.commit();
    }
    catch (error) {
        yield conn.rollback();
        throw error;
    }
    finally {
        conn.release();
    }
});
SubjectService.getSubjectandQuestion = (sessionId, campaign_id) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield subject_repo_1.default.GetSubjectNameandQuestionNo(sessionId, campaign_id);
    return result;
});
