import { Request, Response } from "express";
import { userSessionsService } from "../Service/user-session.service";

export class userSessionsController {

  static findBySessionId = async (req: Request, res: Response) => {
    try {
      const sessionId = parseInt(req.params.sessionId, 10);
      if (isNaN(sessionId)) {
        return res.status(400).send({ message: "Invalid Session ID" });
      }

      const data = await userSessionsService.findBySessionId(sessionId);
      res.status(200).json(data);
    } catch (error: any) {
      res.status(500).send({ message: error.message });
    }
  };
}
