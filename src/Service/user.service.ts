import { Request } from "express"


export class userservice{
    static UserQuery = async(req: Request)=>{
            const {
      campaignId = "",
      sessionId = "",
      subjectId = "",
    } = req.query;
        
    }
}