import userSessionsRepo from "../Repo/user-session.repo";

export class userSessionsService {
  static findBySessionId = async (sessionId: number) => {
    try {
      return await userSessionsRepo.findBySessionId(sessionId);
    } catch (error) {
      console.error("Service Error (findUserSessions):", error);
      throw error;
    }
  };
}
