import sessionRepo from "../Repo/session.repo";
import { ApiSession, CreateSessionPayload } from "../Repo/session.repo";

export class sessionService {
  static create = async (payload: CreateSessionPayload): Promise<ApiSession> => {
    const checkDuplicate = await sessionRepo.checkisDuplicateSessionCode(payload.session_code, payload.campaign_id);
    console.log(payload)
    if (checkDuplicate) {
      throw new Error(`วันที่สอบนี้มีอยู่แล้วในระบบสำหรับรอบสอบนี้`);
    }

    const newSession = await sessionRepo.create(payload);
    return newSession;
  };

    static update = async (exam_date: Date, session_id: number): Promise<ApiSession> => {
    const updatedSession = await sessionRepo.update({ exam_date, id: session_id });
    return updatedSession;
  };

  static delete = async (id: number): Promise<boolean> => {
    const result = await sessionRepo.delete(id);
    console.log("lnwwwadawdwad")
    if (!result) {
      throw new Error(`Failed to delete Session ID ${id} or not found.`);
    }
    return true;
  };
}
