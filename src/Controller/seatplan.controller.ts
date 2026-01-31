import { Request, Response } from "express";
import { SeatPlanService } from "../Service/seatplan.service";

export class SeatPlanController {
    static createPDF = async (req: Request, res: Response) => {
        try {
            const { session_id, campaign_id } = req.params;

            if (!session_id || !campaign_id) {
                return res.status(400).json({
                    message: "Invalid campaign_id or session_id",
                });
            }

            const pdfBuffer = await SeatPlanService.generateSeatPlanPdf({
                session_id: Number(session_id),
                campaign_id: Number(campaign_id),
            });

            res.setHeader("Content-Type", "application/pdf");
            res.setHeader(
                "Content-Disposition",
                `attachment; filename="seatplan_${campaign_id}_${session_id}.pdf"`
            );
            res.send(pdfBuffer);
        } catch (err) {
            console.error("generate seat plan pdf error:", err);
            res.status(500).json({ message: "ไม่สามารถสร้างผังที่นั่งสอบได้" });
        }
    };
    static nameLists = async (req: Request, res: Response) => {
        try {
            const { campaign_id } = req.params;

            const buffer = await SeatPlanService.generateSeatPlanNameListPdf({
                campaign_id: Number(campaign_id)
            });

            res.setHeader("Content-Type", "application/pdf");
            res.setHeader(
                "Content-Disposition",
                `attachment; filename="seatplan_name_list_${campaign_id}.pdf"`
            );
            res.send(buffer);
        } catch (e) {
            console.error(e);
            res.status(500).json({ message: "ไม่สามารถสร้าง PDF รายชื่อได้" });
        }
    }
}
