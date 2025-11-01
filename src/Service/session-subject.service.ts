import { DB } from "../model/DB";
import subjectRepo from "../Repo/subject.repo";
import sessionSubjectRepo from "../Repo/session-subject.repo";
import {
  ApiSubjectResponse,
  CreateSessionSubjectPayload,
  CreateSessionSubjectLinkPayload,
} from "../Repo/session-subject.repo";
import sessionRepo from "../Repo/session.repo";

export class sessionSubjectService {
  /**
   * สร้าง Subject (Find or Create) และ สร้าง Link (Create)
   * (นี่คือ Service ที่ Controller เรียกใช้)
   */
  static create = async (
    payload: CreateSessionSubjectPayload // 👈 (รับ Payload "แบบผสม" จาก Controller)
  ): Promise<ApiSubjectResponse> => {
    const connection = await DB.getInstance().getConnection();
    try {
      await connection.beginTransaction();

      // 1. ค้นหา หรือ สร้าง วิชา (ในตารางแม่ 'subjects')
      const subject = await subjectRepo.findOrCreateByCode(
        payload.code,
        payload.name,
        connection
      );
      console.log(payload);
      const session = await sessionRepo.findById(payload.session_id, connection);
      if (!session) {
        throw new Error(`Session with ID ${payload.session_id} not found.`);
      }

      const examDateISO = new Date(session.exam_date).toISOString(); // e.g. "2025-11-30T17:00:00.000Z"
      const examDatePart = examDateISO.slice(0, 10);                  // -> "2025-11-30"

      // helper: ดึงเฉพาะ HH:mm จากสตริง (กันเคสที่ส่งมาเป็น "2025-11-30T17:00:00.000Z 09:00:00")
      const extractHHmm = (s: string) => {
        const m = s.match(/(\d{2}:\d{2})/);
        if (!m) throw new Error(`Invalid time format: ${s}`);
        return m[1];
      };

      const startTime = extractHHmm(payload.start_at); // "09:00"
      const endTime = extractHHmm(payload.end_at);   // "13:00"

      const startDateTime = `${examDatePart} ${startTime}:00`; // "2025-11-30 09:00:00"
      const endDateTime = `${examDatePart} ${endTime}:00`;   // "2025-11-30 13:00:00"

      console.log("Start DateTime:", startDateTime);
      console.log("End DateTime:", endDateTime);

      const linkPayload: CreateSessionSubjectLinkPayload = {
        session_id: payload.session_id,
        subject_id: subject.id,
        start_at: startDateTime,
        end_at: endDateTime,
        question_count: payload.question_count,
        question_range: payload.question_range || null,
        order_no: payload.order_no || 1,
      };

      // 5. ส่ง Payload ที่ถูกต้องให้ Repo
      const newLink = await sessionSubjectRepo.create(
        linkPayload,
        connection
      );

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

  /**
   * ลบ Subject (Link)
   */
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

      // 2. ตรวจสอบว่ามีวิชานี้ (subjectId) เหลืออยู่ใน 'session_subjects' อีกหรือไม่
      const remainingReferences =
        await sessionSubjectRepo.countReferencesBySubjectId(
          subjectId,
          connection
        );

      // 3. ถ้าไม่เหลือ (เป็น 0) ➔ ให้ลบวิชาออกจาก 'subjects' (ตารางแม่)
      if (remainingReferences === 0) {
        await subjectRepo.delete(subjectId, connection);
      }

      // (ถ้า remainingReferences > 0 เราก็ไม่ต้องทำอะไร)

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

