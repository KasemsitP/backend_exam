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

            const session = await sessionRepo.findById(payload.session_id, connection);
            if (!session) {
                throw new Error(`Session with ID ${payload.session_id} not found.`);
            }

            const examDateISO = new Date(session.exam_date).toISOString();
            const examDatePart = examDateISO.slice(0, 10);

            const extractHHmm = (s: string) => {
                const m = s.match(/(\d{2}:\d{2})/);
                if (!m) throw new Error(`Invalid time format: ${s}`);
                return m[1];
            };

            const startTime = extractHHmm(payload.start_at);
            const endTime = extractHHmm(payload.end_at);

            const startDateTime = `${examDatePart} ${startTime}:00`;
            const endDateTime = `${examDatePart} ${endTime}:00`;

            console.log("Start DateTime:", startDateTime);
            console.log("End DateTime:", endDateTime);

            const linkPayload: CreateSessionSubjectLinkPayload = {
                session_id: payload.session_id,
                subject_id: payload.subject_id,              // 👈 ใช้ subject_id จาก payload
                start_at: startDateTime,
                end_at: endDateTime,
                question_count: payload.question_count,
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

