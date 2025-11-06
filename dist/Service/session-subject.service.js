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
const subject_repo_1 = __importDefault(require("../Repo/subject.repo"));
const session_subject_repo_1 = __importDefault(require("../Repo/session-subject.repo"));
const session_repo_1 = __importDefault(require("../Repo/session.repo"));
class sessionSubjectService {
}
exports.sessionSubjectService = sessionSubjectService;
_a = sessionSubjectService;
/**
 * สร้าง Subject (Find or Create) และ สร้าง Link (Create)
 * (นี่คือ Service ที่ Controller เรียกใช้)
 */
sessionSubjectService.create = (payload // 👈 (รับ Payload "แบบผสม" จาก Controller)
) => __awaiter(void 0, void 0, void 0, function* () {
    const connection = yield DB_1.DB.getInstance().getConnection();
    try {
        yield connection.beginTransaction();
        // 1. ค้นหา หรือ สร้าง วิชา (ในตารางแม่ 'subjects')
        const subject = yield subject_repo_1.default.findOrCreateByCode(payload.code, payload.name, connection);
        console.log(payload);
        const session = yield session_repo_1.default.findById(payload.session_id, connection);
        if (!session) {
            throw new Error(`Session with ID ${payload.session_id} not found.`);
        }
        const examDateISO = new Date(session.exam_date).toISOString(); // e.g. "2025-11-30T17:00:00.000Z"
        const examDatePart = examDateISO.slice(0, 10); // -> "2025-11-30"
        // helper: ดึงเฉพาะ HH:mm จากสตริง (กันเคสที่ส่งมาเป็น "2025-11-30T17:00:00.000Z 09:00:00")
        const extractHHmm = (s) => {
            const m = s.match(/(\d{2}:\d{2})/);
            if (!m)
                throw new Error(`Invalid time format: ${s}`);
            return m[1];
        };
        const startTime = extractHHmm(payload.start_at); // "09:00"
        const endTime = extractHHmm(payload.end_at); // "13:00"
        const startDateTime = `${examDatePart} ${startTime}:00`; // "2025-11-30 09:00:00"
        const endDateTime = `${examDatePart} ${endTime}:00`; // "2025-11-30 13:00:00"
        console.log("Start DateTime:", startDateTime);
        console.log("End DateTime:", endDateTime);
        const linkPayload = {
            session_id: payload.session_id,
            subject_id: subject.id,
            start_at: startDateTime,
            end_at: endDateTime,
            question_count: payload.question_count,
            question_range: payload.question_range || null,
            order_no: payload.order_no || 1,
        };
        // 5. ส่ง Payload ที่ถูกต้องให้ Repo
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
/**
 * ลบ Subject (Link)
 */
sessionSubjectService.delete = (sessionId, subjectId) => __awaiter(void 0, void 0, void 0, function* () {
    const connection = yield DB_1.DB.getInstance().getConnection();
    try {
        yield connection.beginTransaction();
        // 1. ลบการเชื่อมโยง (Link) ใน 'session_subjects'
        const deletedLink = yield session_subject_repo_1.default.deleteByIds(sessionId, subjectId, connection);
        if (!deletedLink) {
            throw new Error("Subject link not found or already deleted.");
        }
        // 2. ตรวจสอบว่ามีวิชานี้ (subjectId) เหลืออยู่ใน 'session_subjects' อีกหรือไม่
        const remainingReferences = yield session_subject_repo_1.default.countReferencesBySubjectId(subjectId, connection);
        // 3. ถ้าไม่เหลือ (เป็น 0) ➔ ให้ลบวิชาออกจาก 'subjects' (ตารางแม่)
        if (remainingReferences === 0) {
            yield subject_repo_1.default.delete(subjectId, connection);
        }
        // (ถ้า remainingReferences > 0 เราก็ไม่ต้องทำอะไร)
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
