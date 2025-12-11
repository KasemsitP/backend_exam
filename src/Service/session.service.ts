import sessionRepo from "../Repo/session.repo";
import { ApiSession, CreateSessionPayload } from "../Repo/session.repo";

export class sessionService {
  static create = async (payload: CreateSessionPayload): Promise<ApiSession> => {
    const newSession = await sessionRepo.create(payload);
    return newSession;
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
