
import graderWorkLockRepo from "../Repo/grader-work-lock.repo";

export class GraderWorkLockSerivce{
  static getBagActiveGrader = async (campaign_id: number) => {
    return await graderWorkLockRepo.findBagReportHeader(campaign_id);
  };
}
