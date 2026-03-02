import { Request, Response } from "express"
import { userservice } from "../Service/user.service";
export class usercontroller {
    static getUsersByCampagin = async (req: Request, res: Response) => {
        try {
            const result = await userservice.getUsersByCampaign(req);
            res.json(result);
        } catch (error: any) {
           // console.log(error)
            return res.status(400).send({ message: error.message });
        }
    }
    static getCountUserCampaign = async (req: Request, res: Response) => {
        try {
            const { campaignId } = req.params;
            if (!campaignId) throw new Error("ไม่พบรอบสอบ");
            const result = await userservice.getCountUserCampaign(Number(campaignId));           
            res.json(result);
        } catch (error: any) {
           // console.log(error)
            return res.status(400).send({ message: error.message });
        }
    }
}