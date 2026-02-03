import { Request, Response } from "express";
import { gradingScoreService } from "../Service/gradingscore.service";
import gradingscoreRepo from "../Repo/gradingscore.repo";

export class gradingscoreController {
  static SubmitScore = async (req: Request, res: Response) => {
    try {
      const { qrPayload, campaignId, slotId, graderId, score } = req.body;

      if (!qrPayload || !campaignId || !graderId || !slotId || score === undefined) {
        return res.status(400).send({ message: "ข้อมูลไม่ครบ" });
      }

      const payload = {
        qrPayload,
        campaignId: Number(campaignId),
        graderId: Number(graderId),
        slotId: Number(slotId),
        score: Number(score),
      }

      const result = await gradingScoreService.submitScore(payload);


      res.status(201).json({ slotId: result.slotId, score: result.score });

    } catch (error: any) {
      res.status(400).send({ message: error.message });
    }
  };

  static FetchRecord = async (req: Request, res: Response) => {
    try {
      const { graderId } = req.params
      if (!graderId) {
        return res.status(400).send({ message: "ไม่พบผู้ตรวจ" });
      }
      const result = await gradingscoreRepo.FindAllRecord(Number(graderId))
      res.status(201).json(result);

    } catch (error: any) {
      res.status(400).send({ message: error.message });
    }
  }
}