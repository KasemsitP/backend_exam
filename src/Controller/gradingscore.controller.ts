import { Request, Response } from "express";
import { gradingScoreService } from "../Service/gradingscore.service";
import gradingscoreRepo from "../Repo/gradingscore.repo";
import { keyService } from "../Service/key.service";
import { random } from "lodash";

export class gradingscoreController {
  static SubmitScore = async (req: Request, res: Response) => {
    try {
      const { qrPayload, campaignId, slotId, graderId, score,question_no } = req.body;

      if (!qrPayload || !campaignId || !graderId || !slotId || score === undefined || question_no === undefined) {
        return res.status(400).send({ message: "ข้อมูลไม่ครบ" });
      }

      const payload = {
        qrPayload,
        campaignId: Number(campaignId),
        graderId: Number(graderId),
        slotId: Number(slotId),
        score: Number(score),
        question_no: Number(question_no),
      }

      const result = await gradingScoreService.submitScore(payload);


      res.status(201).json({ slotId: result.slotId, score: result.score, random_num: result.random_num });

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
      const data = result.map(r => ({
        random_num: r.random_num,
        score: r.score,
        slot_id: r.slot_id,
        enteredAT: r.enteredAT,
        qr_payload : keyService.maskQrPayload(r.qr_payload)
      }))
      res.status(201).json(data);

    } catch (error: any) {
      res.status(400).send({ message: error.message });
    }
  }
}