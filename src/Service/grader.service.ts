// src/Service/grader.service.ts
import { DB } from "../model/DB";
import graderRepo, { DbGraderAssignmentRow } from "../Repo/grader.repo";


export interface ApiGrader {
  grader_id: number;
  account_id: number;
  campaign_id: number;

  session_id: number;
  session_code: string;
  exam_date: string;

  subject_id: number;
  subject_code: string;
  subject_name: string;

  grader_name: string;

  subject_question_id: number;   
  question_no: number
  question_label?: string;       
}


export class graderService {

  static getAllByCampaignId = async (
    campaignIdNumeric: number
  ): Promise<ApiGrader[]> => {
    const connection = await DB.getInstance().getConnection();

    try {
      const rows: DbGraderAssignmentRow[] =
        await graderRepo.findAllAssignmentsByCampaignId(
          campaignIdNumeric,
          connection
        );

      const assignments: ApiGrader[] = rows.map((r) => ({
        grader_id: r.grader_id,
        account_id: r.account_id,
        campaign_id: r.campaign_id,

        session_id: r.session_id,
        session_code: r.session_code,
        exam_date: r.exam_date,
        grader_name: r.grader_name,
        subject_id: r.subject_id,
        subject_code: r.subject_code,
        subject_name: r.subject_name,
        subject_question_id: r.subject_question_id,
        question_no: r.question_no,
        question_label: r.question_label
      }));

      return assignments;
    } catch (error) {
      console.error("Service Error (graderService.getAllByCampaignId):", error);
      throw error;
    } finally {
      connection.release();
    }
  };
  // ---- ด้านล่างยังเก็บ create/update/delete เดิมไว้ได้เหมือนเดิม ----

  static create = async (payload: {
    campaignId: number;
    name: string;
    active?: boolean;
    accountId?: number | null;
  }) => {
    const connection = await DB.getInstance().getConnection();
    try {
      await connection.beginTransaction();

      const result = await graderRepo.create(
        {
          campaign_id: payload.campaignId,
          name: payload.name,
          active: payload.active,
          account_id: payload.accountId,
        },
        connection
      );

      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      console.error("Service Error (graderService.create):", error);
      throw error;
    } finally {
      connection.release();
    }
  };

  static updateById = async (
    id: number,
    payload: {
      name?: string;
      active?: boolean;
      accountId?: number | null;
    }
  ) => {
    const connection = await DB.getInstance().getConnection();
    try {
      await connection.beginTransaction();

      const result = await graderRepo.updateById(
        id,
        {
          name: payload.name,
          active: payload.active,
          account_id: payload.accountId,
        },
        connection
      );

      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      console.error("Service Error (graderService.updateById):", error);
      throw error;
    } finally {
      connection.release();
    }
  };

  static deleteById = async (id: number) => {
    const connection = await DB.getInstance().getConnection();
    try {
      await connection.beginTransaction();

      const result = await graderRepo.deleteById(id, connection);

      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      console.error("Service Error (graderService.deleteById):", error);
      throw error;
    } finally {
      connection.release();
    }
  };
}
