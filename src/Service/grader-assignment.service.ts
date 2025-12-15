// src/Service/grader-assignment.service.ts
import graderRepo, { DbGrader } from "../Repo/grader.repo";
import { DB } from "../model/DB";
import subjectQuestionRepo from "../Repo/subject-assignment.repo";
import graderAssignmentRepo from "../Repo/grader-assignment";

export interface CreateGraderAssignmentInput {
  campaignId: number;
  accountId: number;   
  sessionId: number;
  subjectId: number;
  questionNo: number;
}

export class graderAssignmentService {
  static async createBulk(
    assignments: CreateGraderAssignmentInput[]
  ): Promise<void> {
    if (!assignments || assignments.length === 0) return;

    const conn = await DB.getInstance().getConnection();
    try {
      console.log(assignments)
      await conn.beginTransaction();

      const graderCache = new Map<string, number>();

      for (const a of assignments) {
        const key = `${a.campaignId}-${a.accountId}`;

        let grader: DbGrader | null;
        let graderId: number;

        if (graderCache.has(key)) {
          graderId = graderCache.get(key)!;
        } else {
          grader = await graderRepo.findByCampaignAndAccount(
            a.campaignId,
            a.accountId,
            conn
          );
          console.log(grader)

          if (!grader) {
            grader = await graderRepo.create(
              {
                campaign_id: a.campaignId,
                account_id: a.accountId, 
                active: 1,
              },
              conn
            );
          }
          console.log(grader)

          graderId = grader.id;
          graderCache.set(key, graderId);
        }

        const sq = await subjectQuestionRepo.findBySubjectAndNo(
          a.subjectId,
          a.questionNo,
          conn
        );
        console.log(sq)
        if (!sq) {
          throw new Error(
            `subject_questions not found for subject_id=${a.subjectId}, question_no=${a.questionNo}`
          );
        }

        await graderAssignmentRepo.insertOne(
          {
            grader_id: graderId,
            session_id: a.sessionId,
            subject_id: a.subjectId,
            subject_question_id: sq.id,
          },
          conn
        );
      }

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      console.error("Service Error (graderAssignmentService.createBulk):", err);
      throw err;
    } finally {
      conn.release();
    }
  }
}
