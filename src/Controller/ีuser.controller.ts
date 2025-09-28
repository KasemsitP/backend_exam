import { Request, Response } from "express"
import { userservice } from "../Service/user.service";
export class usercontroller {
    static getUsers = async (req: Request, res: Response) => {
        try {  
            await userservice.UserQuery(req.body)
            res.status(201).json();

        } catch (error: any) {
            return res.status(400).send({ message: error.message });
        }
    }

}