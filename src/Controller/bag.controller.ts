import { Request, Response } from "express";
import { bagService } from "../Service/bag.service";


export class bagController {

  static bulkCreate = async (req: Request, res: Response) => {
    try {
      const payload = req.body;
      // (ควรมีการ Validation Payload)
      if (!payload.campaignId || !payload.sessionId || !payload.prefix || !payload.count || !payload.capacity) {
        return res.status(400).send({ message: "Missing required fields for bulk create" });
      }

      const newBags = await bagService.bulkCreate(payload);
      res.status(201).json(newBags);
    } catch (error: any) {
      res.status(500).send({ message: error.message });
    }
  };



  static CreateBagAndBooklets = async (req: Request, res: Response) => {
    try {
      const { campaignId, payload, datetime , bagNo } = req.body;
      if (!campaignId || !payload || !datetime || !bagNo) {
        return res.status(400).send({ message: "ข้อมูลไม่ครบ" });
      }

      const dateTimes: Date[] = datetime.map((d: string) => new Date(d));
      const result = await bagService.CreateBagAndUpdateBooklets(campaignId, payload ,dateTimes,bagNo);
      return res.status(200).json(result);
    } 
    catch (error: any) {
      res.status(500).send({ message: error.message });
    }
  }

  static CheckSubjectBooklets = async (req: Request, res: Response) => {
    try {
      const { campaignId, payload, datetime } = req.body;
      if (!campaignId || !payload || !datetime) {
        return res.status(400).send({ message: "ข้อมูลไม่ครบ" });
      }
      
      const dateTimes: Date[] = datetime.map((d: string) => new Date(d));
      const result = await bagService.CheckbookletsSubjects(campaignId, payload ,dateTimes);
      return res.status(200).json(result);
    } 
    catch (error: any) {
      res.status(500).send({ message: error.message });
    }
  }

 static createPDF = async (req: Request, res: Response) => {
    try {
      const { bag_id } = req.params;
      if (!bag_id) {
        return res
          .status(400)
          .json({ message: "Invalid Bag ID" });
      }

      // const course = String(req.query.course ?? "วิชาไม่ระบุ");
      // const org = String(req.query.org ?? "");
      // const sessionText = String(req.query.sessionText ?? "");

      const pdfBuffer = await bagService.generateBagPayloadPdfByBagId(Number(bag_id));

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="signsheet_${bag_id}.pdf"`
      );
      res.send(pdfBuffer);
    } catch (err) {
      console.error("generate sign sheet pdf error:", err);
      res.status(500).json({ message: "ไม่สามารถสร้าง PDF ได้" });
    }
  };

static createPDFByCampaignId = async (req: Request, res: Response) => {
  try {
    const campaignId = req.query.campaign_id
      ? Number(req.query.campaign_id)
      : null;

    const sessionId = req.query.session_id
      ? Number(req.query.session_id)
      : null;

    if (!campaignId && !sessionId) {
      return res.status(400).json({
        message: "ต้องส่ง campaign_id หรือ session_id",
      });
    }
    if (campaignId && sessionId) {
      return res.status(400).json({
        message: "ส่งได้แค่ campaign_id หรือ session_id อย่างใดอย่างหนึ่ง",
      });
    }

    let pdfBuffer: Buffer;
    let filename: string;

    if (campaignId) {
      pdfBuffer =
        await bagService.generateBagPayloadAllPdfByCampaignId(campaignId);
      filename = `signsheet_campaign_${campaignId}.pdf`;
    } else {
      pdfBuffer =
        await bagService.generateBagPayloadAllPdfBySessionId(sessionId!);
      filename = `signsheet_session_${sessionId}.pdf`;
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );

    return res.send(pdfBuffer);
  } catch (err) {
    console.error("generate sign sheet pdf error:", err);
    return res.status(500).json({ message: "ไม่สามารถสร้าง PDF ได้" });
  }
};



  // static InsertBooklets = async (req: Request, res: Response) => {
  //   try {
  //     const payload = req.body;
  //     console.log(payload)
  //     if (!payload.campaignId || !payload.bag_no || !payload.scannedCodes) {
  //       //console.log(payload)
  //       return res.status(400).send({ message: "ข้อมูลไม่ครบ" });
  //     }
  //     // console.log(payload, "lnw")
  //     const result = await bagService.InsertBooklets(payload)
  //     res.status(200).json(result);

  //   } catch (error: any) {
  //     console.error("Controller Error (Finalize & Link):", error);
  //     res.status(400).send({ message: error.message });
  //   }
  // };
  static getAllForCampaign = async (req: Request, res: Response) => {
    try {

      const campaignId = req.params.campaignId;
      if (!campaignId) {
        return res.status(400).send({ message: "Missing Campaign ID" });
      }
      const bags = await bagService.getAllByCampaignId(campaignId);
      res.status(200).json(bags);
    } catch (error: any) {
      res.status(500).send({ message: error.message });
    }
  };
  static deleteById = async (req: Request, res: Response) => {
    try {
      const bagId = req.params.bagId;
      if (!bagId) {
        return res.status(400).send({ message: "Missing Bag ID" });
      }
      const result = await bagService.deleteById(Number(bagId));
      console.log(result)
      res.status(200).json(result);
    } catch (error: any) {
      res.status(500).send({ message: error.message });
    }
  };
  static getBookletsInBag = async (req: Request, res: Response) => {
    //console.log("HIT /api/bags/:bagNo/booklets", req.params, req.query);
    try {
      console.log("HIT /api/bags/:bagNo/booklets", req.params, req.query);
      const bagNo = Number(req.params.bagNo);
      const campaignId = Number(req.query.campaignId);
      const sessionId = Number(req.query.sessionId);

      if (!bagNo || !campaignId || !sessionId) {
        return res.status(400).send({ message: "ข้อมูลไม่ครบ" });
      }

      const list = await bagService.getBookletsInBag({
        campaignId,
        sessionId,
        bagNo,
      });
      console.log(list)

      res.json(list);
    } catch (err: any) {
      console.error("Controller Error (getBookletsInBag):", err);
      res.status(500).send({ message: err.message || "ไม่สามารถดึงข้อมูลถุงได้" });
    }
  };

  static getBookScannedCount = async (req: Request, res: Response) => {
    try {
      const campaignId = Number(req.params.campaignId);

      if (!campaignId) {
        return res.status(400).send({ message: "ข้อมูลไม่ครบ" });
      }

      const list = await bagService.getBookScannedCount({
        campaignId,
      });

      res.json(list);
    } catch (err: any) {
      //  console.error("Controller Error (getBookletsInBag):", err);
      res.status(500).send({ message: err.message || "เกิดข้อผิดพลาด" });
    }
  };
}
