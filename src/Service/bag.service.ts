import { Request } from "express"
import bagrepo from "../Repo/bag.repo";
import { Result } from "pg";

export class bagservice {
  static getBagByCampaign = async (req: Request) => {
    const { campaignCode = ''} = req.query
    if (!campaignCode) throw new Error("กรุณาระบุ campaignCode");
    
    const result = await bagrepo.getBags(String(campaignCode))
    if(result.length === 0) throw new Error("ไม่พบข้อมูล")
    return result;

  };
  static CountBagByCampaign = async (req: Request) => {
    const { campaignCode = ''} = req.query
    if (!campaignCode) throw new Error("กรุณาระบุ campaignCode");
    
    const result = await bagrepo.getNumberBags(String(campaignCode))
    if(result.length === 0) throw new Error("ไม่พบข้อมูล")
    return result;
  };
  static insertBagsCheck = async (req: Request) => {
    const { session_code , bag_num , count_item } = req.body
    if (!session_code) throw new Error("กรุณาระบุ session_code");
    if (!bag_num) throw new Error("กรุณาระบุ bag_num");
    if (!count_item) throw new Error("กรุณาระบุ count_item");
    
    const result = await bagrepo.insertBag(String(session_code) , Number(bag_num) , Number(count_item))
    if(result.affectedRows === 0) throw new Error("ไม่พบข้อมูล")
    return result;
  };
}
