// services/dashboard.service.ts
import dashboardRepo from "../Repo/dashboard.repo";

export class DashboardService {
  static async getCampaignDashboard(campaignId: number) {
    const [
      rawBasicCounts,
      rawBagCounts,
      rawGradersCount,
      rawKeyCounts,
      rawImportStatus,
      rawEncryptedStatus,
      rawAvgScorePerQuestion,
      rawScoreDistribution,
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

    // ✅ กัน null / undefined ทุกตัว
    const basicCounts = rawBasicCounts ?? {
      campaign_id: campaignId,
      session_count: 0,
      subject_count: 0,
    };

    const bagCounts = rawBagCounts ?? [];

    const gradersCount = rawGradersCount ?? {
      total_graders: 0,
      graders_with_login: 0,
    };

    const keyCounts = rawKeyCounts ?? {
      total_keys: 0,
      active_keys: 0,
    };

    const importStatus = rawImportStatus ?? [];
    const encryptedStatus = rawEncryptedStatus ?? [];
    const avgScorePerQuestion = rawAvgScorePerQuestion ?? [];

    const scoreDistribution = rawScoreDistribution ?? {
      total_users: 0,
      no_score: 0,
      bucket_0_24: 0,
      bucket_25_49: 0,
      bucket_50_74: 0,
      bucket_75_100: 0,
    };

    // ---------- sessions map ----------
    const sessions: Record<number, any> = {};

    // bags
    bagCounts.forEach((bag: any) => {
      sessions[bag.session_id] = {
        sessionId: bag.session_id,
        sessionCode: bag.session_code,
        bags: {
          total: bag.total_bags,
          capacity: Number(bag.total_capacity ?? 0),
        },
      };
    });

    // import status
    importStatus.forEach((imp: any) => {
      if (!sessions[imp.session_id]) {
        // ถ้าอยากให้มี session แม้ไม่มี bag ให้ uncomment ได้
        // sessions[imp.session_id] = {
        //   sessionId: imp.session_id,
        //   sessionCode: imp.session_code,
        //   bags: { total: 0, capacity: 0 },
        // };
        return;
      }

      sessions[imp.session_id].users = {
        inCampaign: imp.users_in_campaign,
        inSession: imp.users_in_session,
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
        totalUsersInSession: enc.total_users_in_session ?? 0,
      };
    });

    // ---------- response ----------
    return {
      summary: {
        campaignId: basicCounts.campaign_id,
        sessionCount: basicCounts.session_count,
        subjectCount: basicCounts.subject_count,

        graders: {
          total: gradersCount.total_graders ?? 0,
          withLogin: gradersCount.graders_with_login ?? 0,
        },

        keys: {
          total: keyCounts.total_keys ?? 0,
          active: Number(keyCounts.active_keys ?? 0),
        },

        scoreDistribution: {
          totalUsers: scoreDistribution.total_users ?? 0,
          noScore: Number(scoreDistribution.no_score ?? 0),
          buckets: {
            "0-24": Number(scoreDistribution.bucket_0_24 ?? 0),
            "25-49": Number(scoreDistribution.bucket_25_49 ?? 0),
            "50-74": Number(scoreDistribution.bucket_50_74 ?? 0),
            "75-100": Number(scoreDistribution.bucket_75_100 ?? 0),
          },
        },
      },

      sessions,
      avgScorePerQuestion,
    };
  }
}
