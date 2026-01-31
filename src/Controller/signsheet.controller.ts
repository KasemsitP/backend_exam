import { Request, Response } from "express";
import { SignSheetService } from "../Service/signsheet.service";

export class SignSheetController {
  static createPDF = async (req: Request, res: Response) => {
    try {
      const { session_id, campaign_id } = req.params;
      if (!session_id || !campaign_id) {
        return res
          .status(400)
          .json({ message: "Invalid Campaign ID and session_id" });
      }

      const course = String(req.query.course ?? "วิชาไม่ระบุ");
      const org = String(req.query.org ?? "");
      const sessionText = String(req.query.sessionText ?? "");

      const pdfBuffer = await SignSheetService.generateSignSheetPdf({
        campaign_id: Number(campaign_id),
        session_id: Number(session_id),
        course,
        org,
        sessionText,
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="signsheet_${campaign_id}_${session_id}.pdf"`
      );
      res.send(pdfBuffer);
    } catch (err) {
      console.error("generate sign sheet pdf error:", err);
      res.status(500).json({ message: "ไม่สามารถสร้าง PDF ได้" });
    }
  };

  //  สำหรับหน้าเว็บ (pagination)
  static listPaginated = async (req: Request, res: Response) => {
    try {
      const { session_id, campaign_id } = req.params;
      if (!session_id || !campaign_id) {
        return res
          .status(400)
          .json({ message: "Invalid Campaign ID and session_id" });
      }

      // query string: page, limit, search
      const page = parseInt(String(req.query.page ?? "1"), 10);
      const limit = parseInt(String(req.query.limit ?? "10"), 10);
      const search = String(req.query.search ?? "");

      const result = await SignSheetService.getPaginatedUserSessions({
        session_id: Number(session_id),
        campaign_id: Number(campaign_id),
        page,
        limit,
        search,
      });

      // result = { data, meta } จาก repo
      res.json(result);
    } catch (err) {
      console.error("listPaginated error:", err);
      res.status(500).json({ message: "ไม่สามารถดึงข้อมูลผู้เข้าสอบได้" });
    }
  };
}
