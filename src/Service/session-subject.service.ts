import { DB } from "../model/DB";
import sessionSubjectRepo from "../Repo/session-subject.repo";
import {
    ApiSubjectResponse,
    CreateSessionSubjectPayload,
    CreateSessionSubjectLinkPayload,
} from "../Repo/session-subject.repo";
import sessionRepo from "../Repo/session.repo";

export class sessionSubjectService {
    static create = async (
        payload: CreateSessionSubjectPayload
    ): Promise<ApiSubjectResponse> => {
        const connection = await DB.getInstance().getConnection();
        try {
            await connection.beginTransaction();
            console.log(payload);

            const checkHasSubjects = await sessionSubjectRepo.CheckHasSubjects(payload.session_id, connection);
            if (checkHasSubjects) {
                throw new Error("วันที่สอบนี้มีวิชาอยู่แล้ว ไม่สามารถเพิ่มได้");
            }
            console.log("checkHasSubjects:", payload.session_id, payload.subject_id, checkHasSubjects);
            const checkDuplicateSubject = await sessionSubjectRepo.CheckDubplicateSubject(payload.session_id, payload.subject_id, connection);
            console.log("checkDuplicateSubject:", checkDuplicateSubject);
            if (checkDuplicateSubject) {
                throw new Error("วิชานี้ถูกเพิ่มไปแล้ว ไม่สามารถเพิ่มซ้ำได้");
            }

            const session = await sessionRepo.findById(payload.session_id, connection);
            if (!session) {
                throw new Error(`Session with ID ${payload.session_id} not found.`);
            }


            const Qpayload = await sessionSubjectRepo.findNumberofQuestion(payload.subject_id)
            //            console.log(Qpayload.subject_id, payload.subject_id)

            if (Qpayload.subject_id !== payload.subject_id) {
                throw new Error("unmatach subject ID ")
            }
            if (Qpayload.total_questions <= 0) {
                throw new Error("no question found")
            }

            const examDate = new Date(session.exam_date);

            const year = examDate.getFullYear();
            const month = String(examDate.getMonth() + 1).padStart(2, "0");
            const day = String(examDate.getDate()).padStart(2, "0");

            const examDatePart = `${year}-${month}-${day}`;

            const startDateTime = `${examDatePart} ${payload.start_at}:00`;
            const endDateTime = `${examDatePart} ${payload.end_at}:00`;
            console.log("Start DateTime:", startDateTime);
            console.log("End DateTime:", endDateTime);
            //    console.log(payload.question_count)

            const linkPayload: CreateSessionSubjectLinkPayload = {
                session_id: payload.session_id,
                subject_id: payload.subject_id,              // 👈 ใช้ subject_id จาก payload
                start_at: startDateTime,
                end_at: endDateTime,
                question_count: Qpayload.total_questions,
                question_range: payload.question_range || null,
                order_no: payload.order_no || 1,
            };

            const newLink = await sessionSubjectRepo.create(linkPayload, connection);

            await connection.commit();
            return newLink;
        } catch (error) {
            await connection.rollback();
            console.error("Service Error: Failed to create subject link", error);
            throw error;
        } finally {
            connection.release();
        }
    };

    static delete = async (
        sessionId: number,
        subjectId: number
    ): Promise<boolean> => {
        const connection = await DB.getInstance().getConnection();
        try {
            await connection.beginTransaction();

            // 1. ลบการเชื่อมโยง (Link) ใน 'session_subjects'
            const deletedLink = await sessionSubjectRepo.deleteByIds(
                sessionId,
                subjectId,
                connection
            );

            if (!deletedLink) {
                throw new Error("Subject link not found or already deleted.");
            }

            const remainingReferences =
                await sessionSubjectRepo.countReferencesBySubjectId(
                    subjectId,
                    connection
                );
            await connection.commit();
            return true;
        } catch (error) {
            await connection.rollback();
            console.error(
                "Service Error: Failed to delete subject link (and master)",
                error
            );
            throw error;
        } finally {
            connection.release();
        }
    };
}

