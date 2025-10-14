import { Request } from "express"
import bagrepo from "../Repo/bag.repo";
import { Result } from "pg";

export class bagservice {
  static getBagByCampaign = async (req: Request) => {
    const { campaignCode = ''} = req.query
    if (!campaignCode) throw new Error("campaignCode is required");
    
    const result = await bagrepo.getBags(String(campaignCode))
    if(result.length === 0) throw new Error("no information")
    return result;

  };
  static CountBagByCampaign = async (req: Request) => {
    const { campaignCode = ''} = req.query
    if (!campaignCode) throw new Error("campaignCode is required");
    
    const result = await bagrepo.getNumberBags(String(campaignCode))
    if(result.length === 0) throw new Error("no information")
    return result;
  };
  static insertBagsCheck = async (req: Request) => {
    const { session_code , bag_num , count_item } = req.body
    if (!session_code) throw new Error("session_code is required");
    if (!bag_num) throw new Error("bag_num is required");
    if (!count_item) throw new Error("count_item is required");
    
    const result = await bagrepo.insertBag(String(session_code) , Number(bag_num) , Number(count_item))
    if(result.affectedRows === 0) throw new Error("no information")
    return result;
  };
}