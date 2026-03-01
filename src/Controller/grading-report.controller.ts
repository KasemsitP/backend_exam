// src/Controller/gradingReport.controller.ts
import { Request, Response } from "express";
import { GradingReportService } from "../Service/grading-report.service";
import { GraderReportService } from "../Service/grader-report.service";


function asInt(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function parseBool01(v: any, fallback: boolean) {
  if (v === undefined || v === null) return fallback;
  const s = String(v).trim().toLowerCase();
  if (s === "1" || s === "true" || s === "yes") return true;
  if (s === "0" || s === "false" || s === "no") return false;
  return fallback;
}

type AnyGroupItem = any;
//type GroupRule = { title: string; items: AnyGroupItem[] };

function normalizeGroups(input: any): { title: string; items: { sessionId: number; subjectId: number; questionNo: number }[] }[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((g) => {
      const title = String(g?.title ?? "").trim() || "กลุ่ม";
      const rawItems = Array.isArray(g?.items) ? g.items : [];
      const items = rawItems
        .map((it: AnyGroupItem) => {
          const sessionId = asInt(it?.sessionId ?? it?.session_id, 0);
          const subjectId = asInt(it?.subjectId ?? it?.subject_id, 0);
          const questionNo = asInt(it?.questionNo ?? it?.question_no, 0);
          return { sessionId, subjectId, questionNo };
        })
        .filter((x: any) => x.sessionId > 0 && x.subjectId > 0 && x.questionNo > 0);
      return { title, items };
    })
    .filter((g) => g.items.length > 0);
}


export class GradingReportController {
  /**
   * GET /api/reports/bags/:bagId/subjects/:subjectId/scores
   */
  static async getBagSubjectScores(req: Request, res: Response) {
    try {
      const bagId = Number(req.params.bagId);
      // const subjectId = Number(req.params.subjectId);

      if (Number.isNaN(bagId)) { //|| Number.isNaN(subjectId
        return res.status(400).json({ message: "Invalid bagId or subjectId" });
      }

      const result = await GradingReportService.getBagScoresReport(
        bagId,
        //subjectId
      );

      res.json(result);
    } catch (err: any) {
      console.error("Controller Error (getBagSubjectScores):", err);
      res
        .status(500)
        .json({ message: err?.message ?? "Internal server error" });
    }
  }
  static ReportScorePDF = async (req: Request, res: Response) => {
    const bagId = Number(req.params.bagId);
    try {
      const buf = await GradingReportService.generateBagScorePdf(bagId);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="bag-${bagId}-scores.pdf"`
      );
      res.send(buf);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "สร้าง PDF ไม่สำเร็จ" });
    }
  }

  static ReportScoreUserIFUnlock = async (req: Request, res: Response) => {
    const bagId = Number(req.params.bagId);
    try {
      const buf = await GradingReportService.generateUnlockedBagScorePdfUser({ bagId });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="bag-${bagId}-scores.pdf"`
      );
      res.send(buf);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "สร้าง PDF ไม่สำเร็จ" });
    }
  }
  static ReportScoreAllPDF = async (req: Request, res: Response) => {
    const { campaign_id } = req.params
    // console.log(campaign_id)
    try {
      const buf = await GradingReportService.generateCampaignBagScoresPdf(Number(campaign_id));
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="campaign-${campaign_id}-scores.pdf"`
      );
      res.send(buf);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "สร้าง PDF ไม่สำเร็จ" });
    }
  }

  static ReportScoreGraders = async (req: Request, res: Response) => {
    const { bag_id, grader_id } = req.params
    // console.log(campaign_id)
    try {
      const bagId = Number(bag_id);
      const graderId = Number(grader_id);
      console.log(bagId, graderId)

      // ดึงชื่อผู้ตรวจจากฐานข้อมูลเอง
      const graderName = req.query.graderName as string || "................................";

      const pdfBuffer = await GradingReportService.generateGraderBagSummaryPdf(
        bagId,
        graderId,
        graderName
      );

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="grader-summary-bag-${bagId}-grader-${graderId}.pdf"`
      );
      res.send(pdfBuffer);
    } catch (err: any) {
      res.status(500).json({ message: "สร้าง PDF คะแนนผู้ตรวจไม่สำเร็จ" });
    }
  }
  static async exportPassListPdf(req: Request, res: Response) {
    try {
      const campaignId = asInt(req.params.campaignId, 0);
      if (!campaignId) {
        return res.status(400).json({ message: "campaignId ไม่ถูกต้อง" });
      }

      const sort = String(req.query.sort || "score"); // score | examCode | name
      const order = String(req.query.order || "desc"); // asc | desc
      const includeScore = String(req.query.includeScore || "0") === "1";

      const pdfBuffer = await GradingReportService.generatePassListPdf({
        campaignId,
        sort,
        order,
        includeScore,
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="pass-list-campaign-${campaignId}.pdf"`
      );
      return res.status(200).send(pdfBuffer);
    } catch (err: any) {
      console.error(err);
      return res
        .status(500)
        .json({ message: err?.message || "Export PDF ไม่สำเร็จ" });
    }
  }
  static async exportRankingPdf(req: Request, res: Response) {
    try {
      const campaignId = asInt(req.params.campaignId, 0);
      if (!campaignId) return res.status(400).json({ message: "campaignId ไม่ถูกต้อง" });

      const subjectIds = String(req.query.subjectIds || "")
        .split(",")
        .map((x) => Number(x.trim()))
        .filter((n) => Number.isFinite(n) && n > 0);

      if (subjectIds.length === 0) {
        return res.status(400).json({ message: "กรุณาส่ง subjectIds อย่างน้อย 1 รายการ" });
      }

      const sortBy = String(req.query.sortBy || "TOTAL_DESC");
      const includeRankNo = parseBool01(req.query.includeRankNo, true);
      const includeRoomSeat = parseBool01(req.query.includeRoomSeat, true);
      const includeAvgExplain = parseBool01(req.query.includeAvgExplain, true);
      const onlyCompleted = parseBool01(req.query.onlyCompleted, false);

      const limit = Math.min(Math.max(asInt(req.query.limit, 0), 0), 5000); // 0 = ไม่จำกัด

      let groups: any[] = [];
      const groupsRaw = req.query.groups;
      if (groupsRaw) {
        try {
          groups = JSON.parse(String(groupsRaw));
          if (!Array.isArray(groups)) groups = [];
        } catch {
          return res.status(400).json({ message: "groups JSON ไม่ถูกต้อง" });
        }
      }

      const pdf = await GradingReportService.generateRankingPdf({
        campaignId,
        subjectIds,
        sortBy,
        includeRankNo,
        includeRoomSeat,
        includeAvgExplain,
        onlyCompleted,
        limit,
        groups: normalizeGroups(groups),
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="ranking-${campaignId}.pdf"`);
      return res.status(200).send(pdf);
    } catch (err: any) {
      console.error(err);
      return res.status(500).json({ message: err?.message || "Export ranking PDF ไม่สำเร็จ" });
    }
  }

  // ✅ POST version (body)
  static async exportRankingPdfPost(req: Request, res: Response) {
    try {
      const campaignId = asInt(req.params.campaignId, 0);
      if (!campaignId) return res.status(400).json({ message: "campaignId ไม่ถูกต้อง" });

      const subjectIds = Array.isArray(req.body?.subjectIds)
        ? req.body.subjectIds.map((x: any) => asInt(x, 0)).filter((n: number) => n > 0)
        : [];

      if (subjectIds.length === 0) {
        return res.status(400).json({ message: "กรุณาส่ง subjectIds อย่างน้อย 1 รายการ" });
      }

      const sortBy = String(req.body?.sortBy || "TOTAL_DESC");
      const includeRankNo = !!req.body?.includeRankNo;
      const includeRoomSeat = !!req.body?.includeRoomSeat;
      const includeAvgExplain = !!req.body?.includeAvgExplain;
      const onlyCompleted = !!req.body?.onlyCompleted;

      const limit = Math.min(Math.max(asInt(req.body?.limit, 0), 0), 5000);

      const groups = normalizeGroups(req.body?.groups);

      const pdf = await GradingReportService.generateRankingPdf({
        campaignId,
        subjectIds,
        sortBy,
        includeRankNo,
        includeRoomSeat,
        includeAvgExplain,
        onlyCompleted,
        limit,
        groups,
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="ranking-${campaignId}.pdf"`);
      return res.status(200).send(pdf);
    } catch (err: any) {
      console.error(err);
      return res.status(500).json({ message: err?.message || "Export ranking PDF ไม่สำเร็จ" });
    }
  }


  static async exportBagGradersPdf(req: Request, res: Response) {
    try {
      const bagId = Number(req.params.bagId);
      console.log("exportBagGradersPdf - bagId:", bagId, );
      if (!bagId ) return res.status(400).json({ message: "bagId/subjectId ไม่ถูกต้อง" });

      const pdf = await GraderReportService.generateBagGraderPdf(bagId);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="bag-${bagId}-graders.pdf"`);
      return res.status(200).send(pdf);
    } catch (e: any) {
      console.error(e);
      return res.status(500).json({ message: e?.message ?? "export pdf failed" });
    }
  }
  static async exportCampaignAllBagsGradersPdf(req: Request, res: Response) {
    try {
      const campaignId = asInt(req.params.campaignId, 0);

      if (!campaignId) {
        return res.status(400).json({ message: "campaignId ไม่ถูกต้อง" });
      }

      console.log(`Generating Grader Report for Campaign: ${campaignId}`);

      // Call the optimized service method
      const pdf = await GraderReportService.generateCampaignAllBagsGradersPdf(
        campaignId
      );

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="campaign-${campaignId}-allbags-graders.pdf"`
      );
      return res.status(200).send(pdf);
    } catch (err: any) {
      console.error("exportCampaignAllBagsGradersPdf Error:", err);
      return res.status(500).json({ message: err?.message || "Export PDF ไม่สำเร็จ" });
    }
  }
}
