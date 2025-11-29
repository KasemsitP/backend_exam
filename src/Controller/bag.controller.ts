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


  static finalizeAndLink = async (req: Request, res: Response) => {
    try {
      const payload = req.body;
      // (Validation)
      if (!payload.campaignId || !payload.bagId || !payload.scannedCodes || !Array.isArray(payload.scannedCodes)) {
        return res.status(400).send({ message: "Missing required fields for finalize" });
      }
      const result = await bagService.finalizeAndLink(payload);
      res.status(200).json(result);
    } catch (error: any) {
      console.error("Controller Error (Finalize & Link):", error);
      // (ส่ง Error Message ที่ Key Service ถอดรหัสไม่สำเร็จกลับไป)
      res.status(400).send({ message: error.message });
    }
  };
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
      const result = await bagService.deleteById(bagId);
        console.log(result)
      res.status(200).json(result);
    } catch (error: any) {
      res.status(500).send({ message: error.message });
    }
  };
}
