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
      if (!slotId) {
        return res.status(400).json({ message: "slotId ไม่ถูกต้อง" });
      }

      await gradingRecheckService.resetQuestionForRecheck({ slotId });

      return res.json({ message: "รีเซ็ตคะแนนเพื่อ recheck เรียบร้อยแล้ว" });
    } catch (err: any) {
      console.error(err);
      return res
        .status(500)
        .json({ message: err.message || "Internal Server Error" });
    }
  }
    static async scanDisputed(req: Request, res: Response) {
    try {
      const { qrPayload, campaignId } = req.body;

      if (!qrPayload || !campaignId) {
        return res.status(400).json({ message: "ข้อมูลไม่ครบ" });
      }

      const result = await gradingRecheckService.scanDisputedFromQr({
        qrPayload,
        campaignId: Number(campaignId),
      });

      return res.json(result);
    } catch (err: any) {
      console.error(err);
      return res
        .status(400)
        .json({ message: err.message ?? "เกิดข้อผิดพลาด" });
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
        .status(500)
        .json({ message: err.message || "Internal Server Error" });
    }
  }
}
