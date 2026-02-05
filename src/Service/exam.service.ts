import examDataRepo from "../Repo/exam.repo";
import { DB } from "../model/DB";

import { ExamDataPayload } from "../Repo/exam.repo";

export class examDataService {
  static getInitialData = async (): Promise<ExamDataPayload> => {
    try {
      const [campaigns, sessions, subjects] = await Promise.all([
        examDataRepo.fetchCampaignsNoActive(),
        examDataRepo.fetchSessionsNoactive(),
        examDataRepo.fetchSubjectsNoactive(),
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
  static getCampaignNoactive = async (): Promise<ExamDataPayload> => {
    try {
      const [campaigns, sessions, subjects] = await Promise.all([
        examDataRepo.fetchCampaignsNoActive(),
        examDataRepo.fetchSessionsNoactive(),
        examDataRepo.fetchSubjectsNoactive(),
      ]);

      return {
        campaigns,
        sessions,
        subjects,
      };
    } catch (error) {
      console.error("Service Error: Failed to get Campaigm Exam data", error);
      throw new Error("ไม่สามารถดึงข้อมูลตั้งต้นของระบบได้");
    }
  };

static ActiveInActiveCampaign = async (campaign_id: number) => {
  const conn = await DB.getInstance().getConnection();
  try {
    await conn.beginTransaction();

    const examLists = await examDataRepo.CampaignLists(conn);
    const is_active = await examDataRepo.Checkactive(conn, campaign_id);

    // หา current active (ถ้ามี)
    const current_active = examLists.find((row) => row.is_active === 1);

    if (is_active === 0) {
      if (current_active && current_active.id !== campaign_id) {

        throw new Error("มีรอบสอบที่เปิดใช้งานอยู่แล้ว กรุณาปิดรอบสอบเดิมก่อน");
      }
      await examDataRepo.UpdateExamActive(conn, campaign_id);
    } else {
      await examDataRepo.UpdateExamNoActive(conn, campaign_id);
    }

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    console.error("Active/InActive Campaign Error:", error);
    throw error;
  } finally {
    conn.release();
  }
};
}
