// src/controller/gradingRecheck.controller.ts
import { Request, Response } from "express";
import { gradingRecheckService } from "../Service/gradingrecheck.service";

export class GradingRecheckController {
  // สแกน QR เพื่อหา slot สำหรับ recheck (reuse logic เดิม)
  static async createRecheckSlot(req: Request, res: Response) {
    try {
      const { qrPayload, campaignId, graderId, questionNo } = req.body;

      if (!qrPayload || !campaignId || !graderId || !questionNo) {
        return res.status(400).send({ message: "ข้อมูลไม่ครบ" });
      }

      const result = await gradingRecheckService.createRecheckSlotFromQr({
        qrPayload,
        campaignId: Number(campaignId),
        graderId: Number(graderId),
        questionNo: Number(questionNo),
      });

      return res.status(201).json(result);
    } catch (error: any) {
      console.error(error);
      return res.status(400).send({ message: error.message ?? "เกิดข้อผิดพลาด" });
    }
  }

  // reset คะแนนของข้อหนึ่งให้ recheck ใหม่
  static async resetRecheck(req: Request, res: Response) {
    try {
      const slotId = Number(req.params.slotId);
      const userId = Number(req.params.userId);
      if (!slotId) {
        return res.status(400).json({ message: "slotId ไม่ถูกต้อง" });
      }
      if(!userId){
        return res.status(400).json({ message: "userId ไม่ถูกต้อง" });
      }
      throw new Error("ฟีเจอร์นี้ยังไม่เปิดใช้งาน");

      await gradingRecheckService.resetQuestionForRecheck({ slotId, userId });

      return res.json({ message: "รีเซ็ตคะแนนเพื่อ recheck เรียบร้อยแล้ว" });
    } catch (err: any) {
      console.error(err);
      return res
        .status(400)
        .json({ message: err.message || "Internal Server Error" });
    }
  }

  static async ResetScore(req: Request, res: Response) {
    try {
      const {slotId1 , slotId2 , userId , score1 , score2} = req.body;
      if (!slotId1 || !slotId2 || !userId || score1 === undefined || score2 === undefined) {
        return res.status(400).json({ message: "ข้อมูลไม่ครบ" });
      }
      await gradingRecheckService.EditResetScore(Number(slotId1), Number(slotId2), Number(score1), Number(score2), Number(userId));
      return res.json({ message: "รีเซ็ตคะแนนเรียบร้อยแล้ว" , success: true });
    } catch (err: any) {
      console.error(err);
      return res
        .status(400)
        .json({ message: err.message || "Internal Server Error", success: false });
    }
  }
    static async listDisputed(req: Request, res: Response) {
    try {
      const {campaign_id} = req.params
      const threshold = req.query.threshold
        ? Number(req.query.threshold)
        : 4;
      console.log(campaign_id)
      const rows = await gradingRecheckService.listDisputedQuestions(
        threshold,
        Number(campaign_id),
      );

      return res.json(rows);
    } catch (err: any) {
      console.error(err);
      return res
        .status(400)
        .json({ message: err.message || "Internal Server Error" });
    }
  }
}
