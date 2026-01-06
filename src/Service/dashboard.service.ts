// services/dashboard.service.ts
import dashboardRepo from "../Repo/dashboard.repo";

export class DashboardService {
  static async getCampaignDashboard(campaignId: number) {
    const [
      basicCounts,
      bagCounts,
      gradersCount,
      keyCounts,
      importStatus,
      encryptedStatus,
      avgScorePerQuestion,
      scoreDistribution,
    ] = await Promise.all([
      dashboardRepo.getCampaignBasicCounts(campaignId),
      dashboardRepo.getBagCountsPerSession(campaignId),
      dashboardRepo.getGradersCount(campaignId),
      dashboardRepo.getKeyCounts(campaignId),
      dashboardRepo.getStatusSession(campaignId),
      dashboardRepo.getIsEncrypted(campaignId),
      dashboardRepo.getAverageScorePerQuestion(campaignId),
      dashboardRepo.getScoreDistribution(campaignId),
    ]);

    const sessions: Record<number, any> = {};

    bagCounts.forEach((bag) => {
      sessions[bag.session_id] = {
        sessionId: bag.session_id,
        sessionCode: bag.session_code,
        bags: {
          total: bag.total_bags,
          capacity: Number(bag.total_capacity),
        },
      };
    });


    importStatus.forEach((imp) => {
      if (!sessions[imp.session_id]) return;

      sessions[imp.session_id].users = {
        inCampaign: imp.users_in_campaign,
        inSession: imp.users_in_session,
      };
      sessions[imp.session_id].importStatus = imp.import_status;
    });


    encryptedStatus.forEach((enc) => {
      if (!sessions[enc.session_id]) return;

      sessions[enc.session_id].encryption = {
        status: enc.encryption_status,
        encrypted: Number(enc.encrypted_users),
        pending: Number(enc.pending_users),
      };
    });

    return {
      summary: {
        campaignId: basicCounts.campaign_id,
        sessionCount: basicCounts.session_count,
        subjectCount: basicCounts.subject_count,

        graders: {
          total: gradersCount.total_graders,
          withLogin: gradersCount.graders_with_login,
        },

        keys: {
          total: keyCounts.total_keys,
          active: Number(keyCounts.active_keys),
        },

        scoreDistribution: {
          totalUsers: scoreDistribution.total_users,
          noScore: Number(scoreDistribution.no_score),
          buckets: {
            "0-24": Number(scoreDistribution.bucket_0_24),
            "25-49": Number(scoreDistribution.bucket_25_49),
            "50-74": Number(scoreDistribution.bucket_50_74),
            "75-100": Number(scoreDistribution.bucket_75_100),
          },
        },
      },

      sessions,
      avgScorePerQuestion,
    };
  }
}
