import examDataRepo from "../Repo/exam.repo";

import { ExamDataPayload } from "../Repo/exam.repo";


export class examDataService {
  static getInitialData = async (): Promise<ExamDataPayload> => {
    try {
      const [campaigns, sessions, subjects] = await Promise.all([
        examDataRepo.fetchActiveCampaigns(),
        examDataRepo.fetchSessionsForActiveCampaigns(),
        examDataRepo.fetchSubjectsForActiveCampaigns(),
      ]);

      return {
        campaigns,
        sessions,
        subjects,
      };
    } catch (error) {
      console.error("Service Error: Failed to get initial data", error);
      throw new Error("ไม่สามารถดึงข้อมูลตั้งต้นของระบบได้");
    }
  };
}
