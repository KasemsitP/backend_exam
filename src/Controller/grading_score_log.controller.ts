
import { Request, Response } from "express";
import { gradingScoreLogService } from "../Service/grading_score_log.service";

export class gradingScoreLogController {
    static getScoreLogByBagId = async (req: Request, res: Response) => {
        try {
            const bagId = Number(req.params.bagId);
            if (isNaN(bagId) || bagId <= 0) {
                return res.status(400).json({ message: "bagId ต้องเป็นตัวเลขบวก" });
            }
            const scoreLog = await gradingScoreLogService.getScoreLogByBagId(bagId);
            res.status(200).json(scoreLog);
        } catch (error: any) {
            console.error("Controller Error (gradingScoreLogController.getScoreLogByBagId):", error);
            res.status(500).json({ message: error?.message ?? "Failed to get score log" });
        }
    };

}
