import { Request, Response } from "express";
import GradingScoreDraftService from "../Service/gradingscoredraft.service";

class GradingScoreDraftController {
  static saveDraftScore = async (req: Request, res: Response) => {
    try {
      const { slotId, campaignId, graderId, question_no, score } = req.body;
      console.log(req.body)

      if (
        slotId === undefined ||
        campaignId === undefined ||
        graderId === undefined ||
        question_no === undefined ||
        score === undefined
      ) {
        return res.status(400).json({
          message: "ข้อมูลไม่ครบ",
        });
      }

      const result = await GradingScoreDraftService.saveDraftScore({
        slotId: Number(slotId),
        campaignId: Number(campaignId),
        graderId: Number(graderId),
        questionNo: Number(question_no),
        score: Number(score),
      });

      return res.status(200).json({
        message: "บันทึกคะแนน draft สำเร็จ",
        data: result,
      });
    } catch (error: any) {
      return res.status(500).json({
        message: error.message || "เกิดข้อผิดพลาดในการบันทึก draft score",
      });
    }
  };

  static getDraftsByBagId = async (req: Request, res: Response) => {
    try {
      const bagId = Number(req.params.bagId);

      if (!bagId) {
        return res.status(400).json({
          message: "bagId ไม่ถูกต้อง",
        });
      }

      const result = await GradingScoreDraftService.getDraftsByBagId(bagId);

      return res.status(200).json({
        message: "ดึง draft scores สำเร็จ",
        data: result,
      });
    } catch (error: any) {
      return res.status(500).json({
        message: error.message || "เกิดข้อผิดพลาดในการดึง draft scores",
      });
    }
  };
  static getDraftsUnconfirmed = async (req: Request, res: Response) => {
    try {
      const graderId = Number(req.params.graderId);



      if (!graderId) {
        return res.status(400).json({
          message: "graderId ไม่ถูกต้อง",
        });
      }

      const result = await GradingScoreDraftService.getDraftsUnconfirmed(graderId );

      return res.status(200).json({
        message: "ดึง draft scores สำเร็จ",
        data: result,
      });
    } catch (error: any) {
      return res.status(500).json({
        message: error.message || "เกิดข้อผิดพลาดในการดึง draft scores",
      });
    }
  };

static confirmBagScores = async (req: Request, res: Response) => {
  try {
    const { bagId, graderId, scores } = req.body;

    if (!bagId || !graderId || !Array.isArray(scores) || scores.length === 0) {
      return res.status(400).json({
        message: "ข้อมูลไม่ครบ",
      });
    }

    const result = await GradingScoreDraftService.confirmBagScores({
      bagId: Number(bagId),
      graderId: Number(graderId),
      scores: scores.map((s: any) => ({
        slot_id: Number(s.slot_id),
        question_no: Number(s.question_no),
        score: Number(s.score),
      })),
    });

    return res.status(200).json({
      message: "ยืนยันคะแนนทั้งถุงสำเร็จ",
      data: result,
    });
  } catch (error: any) {
    return res.status(500).json({
      message: error.message || "เกิดข้อผิดพลาดในการยืนยันคะแนน",
    });
  }
};

  static cancelDraftScore = async (req: Request, res: Response) => {
    try {
      const { slotId } = req.body;

      if (slotId === undefined) {
        return res.status(400).json({
          message: "slotId ไม่ถูกต้อง",
        });
      }

      const result = await GradingScoreDraftService.cancelDraftScore({
        slotId: Number(slotId),
      });

      return res.status(200).json({
        message: "ยกเลิก draft score สำเร็จ",
        data: result,
      });
    } catch (error: any) {
      return res.status(500).json({
        message: error.message || "เกิดข้อผิดพลาดในการยกเลิก draft score",
      });
    }
  };
}

export default GradingScoreDraftController;