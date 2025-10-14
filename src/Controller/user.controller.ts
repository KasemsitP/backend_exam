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
}