import { Request } from "express"
import userepo from "../Repo/user.repo";
import { Result } from "pg";

export class userservice {
  static getUsersByCampaign = async (req: Request) => {
    const { campaignCode = '', limit = '25', offset = '0' } = req.query;
    if (!campaignCode) throw new Error("กรุณาระบุ campaignCode");
    //console.log('[usersByCampaign] params =', { campaignCode, limit, offset});
    const result = await userepo.getUsersByCampaign(String(campaignCode))
    if(result.length === 0) throw new Error("ไม่พบข้อมูล")
    return result;
  };
}
