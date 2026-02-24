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
exports.sessionSubjectService = void 0;
const DB_1 = require("../model/DB");
const session_subject_repo_1 = __importDefault(require("../Repo/session-subject.repo"));
const session_repo_1 = __importDefault(require("../Repo/session.repo"));
class sessionSubjectService {
}
exports.sessionSubjectService = sessionSubjectService;
_a = sessionSubjectService;
sessionSubjectService.create = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const connection = yield DB_1.DB.getInstance().getConnection();
    try {
        yield connection.beginTransaction();
        console.log(payload);
        const checkHasSubjects = yield session_subject_repo_1.default.CheckHasSubjects(payload.session_id, connection);
        if (checkHasSubjects) {
            throw new Error("วันที่สอบนี้มีวิชาอยู่แล้ว ไม่สามารถเพิ่มได้");
        }
        console.log("checkHasSubjects:", payload.session_id, payload.subject_id, checkHasSubjects);
        const checkDuplicateSubject = yield session_subject_repo_1.default.CheckDubplicateSubject(payload.session_id, payload.subject_id, connection);
        console.log("checkDuplicateSubject:", checkDuplicateSubject);
        if (checkDuplicateSubject) {
            throw new Error("วิชานี้ถูกเพิ่มไปแล้ว ไม่สามารถเพิ่มซ้ำได้");
        }
        const session = yield session_repo_1.default.findById(payload.session_id, connection);
        if (!session) {
            throw new Error(`Session with ID ${payload.session_id} not found.`);
        }
        const Qpayload = yield session_subject_repo_1.default.findNumberofQuestion(payload.subject_id);
        //            console.log(Qpayload.subject_id, payload.subject_id)
        if (Qpayload.subject_id !== payload.subject_id) {
            throw new Error("unmatach subject ID ");
        }
        if (Qpayload.total_questions <= 0) {
            throw new Error("no question found");
        }
        const examDateISO = new Date(session.exam_date).toISOString();
        const examDatePart = examDateISO.slice(0, 10);
        const extractHHmm = (s) => {
            const m = s.match(/(\d{2}:\d{2})/);
            if (!m)
                throw new Error(`Invalid time format: ${s}`);
            return m[1];
        };
        const startTime = extractHHmm(payload.start_at);
        const endTime = extractHHmm(payload.end_at);
        const startDateTime = `${examDatePart} ${startTime}:00`;
        const endDateTime = `${examDatePart} ${endTime}:00`;
        console.log("Start DateTime:", startDateTime);
        console.log("End DateTime:", endDateTime);
        //    console.log(payload.question_count)
        const linkPayload = {
            session_id: payload.session_id,
            subject_id: payload.subject_id, // 👈 ใช้ subject_id จาก payload
            start_at: startDateTime,
            end_at: endDateTime,
            question_count: Qpayload.total_questions,
            question_range: payload.question_range || null,
            order_no: payload.order_no || 1,
        };
        const newLink = yield session_subject_repo_1.default.create(linkPayload, connection);
        yield connection.commit();
        return newLink;
    }
    catch (error) {
        yield connection.rollback();
        console.error("Service Error: Failed to create subject link", error);
        throw error;
    }
    finally {
        connection.release();
    }
});
sessionSubjectService.delete = (sessionId, subjectId) => __awaiter(void 0, void 0, void 0, function* () {
    const connection = yield DB_1.DB.getInstance().getConnection();
    try {
        yield connection.beginTransaction();
        // 1. ลบการเชื่อมโยง (Link) ใน 'session_subjects'
        const deletedLink = yield session_subject_repo_1.default.deleteByIds(sessionId, subjectId, connection);
        if (!deletedLink) {
            throw new Error("Subject link not found or already deleted.");
        }
        const remainingReferences = yield session_subject_repo_1.default.countReferencesBySubjectId(subjectId, connection);
        yield connection.commit();
        return true;
    }
    catch (error) {
        yield connection.rollback();
        console.error("Service Error: Failed to delete subject link (and master)", error);
        throw error;
    }
    finally {
        connection.release();
    }
});
