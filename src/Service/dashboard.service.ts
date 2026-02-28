// services/dashboard.service.ts
import dashboardRepo from "../Repo/dashboard.repo";
import gradingscoreRepo from "../Repo/gradingscore.repo";

/** simple in-memory TTL cache */
type CacheEntry<T> = { exp: number; data: T };
const cache = new Map<string, CacheEntry<any>>();

async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.exp > now) return hit.data as T;

  const data = await fn();
  cache.set(key, { exp: now + ttlMs, data });
  return data;
}

export class DashboardService {
  /**
   * FAST: summary only (ควรเร็ว)
   * - basic counts
   * - bag counts per session
   * - graders count
   * - key counts
   * - import status per session
   * - encrypted status per session
   * - booklets counts
   * - seat assignment status (rooms)
   * - subject questions (ถ้าหนักมากสามารถแยกไปอีก endpoint ได้)
   */
  static async getCampaignDashboardSummary(campaignId: number) {
    return cached(`dash:summary:${campaignId}`, 30_000, async () => {
      const [
        rawBasicCounts,
        rawBagCounts,
        rawGradersCount,
        rawKeyCounts,
        rawImportStatus,
        rawEncryptedStatus,
        rawSubjectQuestions,
        rawBookletsCount,
        rawBookletsBySession,
        rawSeatAssignmentStatus,
      ] = await Promise.all([
        dashboardRepo.getCampaignBasicCounts(campaignId),
        dashboardRepo.getBagCountsPerSession(campaignId),
        dashboardRepo.getGradersCount(campaignId),
        dashboardRepo.getKeyCounts(campaignId),
        dashboardRepo.getStatusSession(campaignId),
        dashboardRepo.getIsEncrypted(campaignId),
        dashboardRepo.getSubjectQuestionsByCampaign(campaignId),
        dashboardRepo.getCountBookets(campaignId),
        dashboardRepo.getCountBookletsBySession(campaignId),
        dashboardRepo.isAssigned(campaignId),
      ]);

      const basicCounts = rawBasicCounts ?? {
        campaign_id: campaignId,
        session_count: 0,
        subject_count: 0,
      };

      const bagCounts = rawBagCounts ?? [];
      const gradersCount = rawGradersCount ?? { total_graders: 0, graders_with_login: 0 };
      const keyCounts = rawKeyCounts ?? { total_keys: 0, active_keys: 0 };
      const importStatus = rawImportStatus ?? [];
      const encryptedStatus = rawEncryptedStatus ?? [];

      const sessions: Record<number, any> = {};

      // bags
      bagCounts.forEach((bag: any) => {
        sessions[bag.session_id] = {
          sessionId: bag.session_id,
          sessionCode: bag.session_code,
          subject_name: bag.subject_name,
          bags: {
            total: Number(bag.total_bags ?? 0),
            capacity: Number(bag.total_capacity ?? 0),
          },
        };
      });

      // import status
      importStatus.forEach((imp: any) => {
        if (!sessions[imp.session_id]) return;
        sessions[imp.session_id].users = {
          inCampaign: Number(imp.users_in_campaign ?? 0),
          inSession: Number(imp.users_in_session ?? 0),
        };
        sessions[imp.session_id].importStatus = imp.import_status;
      });

      // encryption status
      encryptedStatus.forEach((enc: any) => {
        if (!sessions[enc.session_id]) return;
        sessions[enc.session_id].encryption = {
          status: enc.encryption_status,
          encrypted: Number(enc.encrypted_users ?? 0),
          pending: Number(enc.pending_users ?? 0),
          totalUsersInSession: Number(enc.total_users_in_session ?? 0),
        };
      });

      // subject questions → grouped by subject
      const subjectQuestionsBySubject: Record<
        number,
        {
          subjectId: number;
          code: string;
          name: string;
          questions: { id: number; questionNo: number; label: string | null; maxScore: number | null }[];
        }
      > = {};

      (rawSubjectQuestions ?? []).forEach((row: any) => {
        if (!subjectQuestionsBySubject[row.subject_id]) {
          subjectQuestionsBySubject[row.subject_id] = {
            subjectId: row.subject_id,
            code: row.subject_code,
            name: row.subject_name,
            questions: [],
          };
        }

        // sq อาจ null ถ้ายังไม่มี questions
        if (row.subject_question_id != null) {
          subjectQuestionsBySubject[row.subject_id].questions.push({
            id: row.subject_question_id,
            questionNo: row.question_no,
            label: row.question_label,
            maxScore: row.max_score,
          });
        }
      });

      return {
        summary: {
          campaignId: basicCounts.campaign_id,
          sessionCount: Number(basicCounts.session_count ?? 0),
          subjectCount: Number(basicCounts.subject_count ?? 0),

          graders: {
            total: Number(gradersCount.total_graders ?? 0),
            withLogin: Number(gradersCount.graders_with_login ?? 0),
          },

          keys: {
            total: Number(keyCounts.total_keys ?? 0),
            active: Number(keyCounts.active_keys ?? 0),
          },
        },

        sessions,
        subjectQuestions: subjectQuestionsBySubject,

        rawBookletsCount: Number(rawBookletsCount ?? 0),
        rawBookletsBySession: rawBookletsBySession ?? [],
        seatAssignmentStatus: rawSeatAssignmentStatus ?? [],
      };
    });
  }

  /**
   * SLOWER: charts / analytics (โหลดทีหลัง)
   * - score distribution (bucketed in SQL)
   * - avg score per question (simple)
   * - disputed questions
   * - average question score (grader1/2/final) แบบ optimized
   *
   * NOTE: rawStatus/slotCoverage หนักมาก → แยก endpoint ต่างหากถ้าจะใช้
   */
  static async getCampaignDashboardCharts(campaignId: number) {
    return cached(`dash:charts:${campaignId}`, 30_000, async () => {
      const [
        rawAvgScorePerQuestion,
        rawScoreDistribution,
        rawDisputedQuestions,
        rawAverageQuestionScore,
      ] = await Promise.all([
        dashboardRepo.getAverageScorePerQuestion(campaignId),
        dashboardRepo.getScoreDistributionBucketed(campaignId),
        gradingscoreRepo.findDisputedQuestionsForDashboard(campaignId, 4),
        dashboardRepo.getAverageQuestionScoreOptimized(campaignId),
      ]);

      // group averageQuestionScore by session_id for FE
      const grouped = (rawAverageQuestionScore ?? []).reduce((acc: any, item: any) => {
        if (!acc[item.session_id]) acc[item.session_id] = [];
        acc[item.session_id].push({
          subject_id: item.subject_id,
          question_no: item.question_no,
          label: item.label,
          category: item.category,
          grader1_avg: Number(item.grader1_avg ?? 0),
          grader2_avg: Number(item.grader2_avg ?? 0),
          final_avg: Number(item.final_avg ?? 0),
          n1: Number(item.n1 ?? 0),
          n2: Number(item.n2 ?? 0),
        });
        return acc;
      }, {});
      console.log( rawScoreDistribution)
      return {
        avgScorePerQuestion: rawAvgScorePerQuestion ?? [],
     scoreDistribution: rawScoreDistribution, //
        rawDisputedQuestions: rawDisputedQuestions ?? [],
        rawAverageQuestionScore: grouped,
      };
    });
  }

  /**
   * OPTIONAL: heavy debug endpoint (ควร cache นาน + เรียกเฉพาะตอนกดดู)
   */
  static async getCampaignDashboardSlotCoverage(campaignId: number) {
    return cached(`dash:slotCoverage:${campaignId}`, 5 * 60_000, async () => {
      const rawStatus = await dashboardRepo.getStatus(campaignId);
      return { rawStatus };
    });
  }
}