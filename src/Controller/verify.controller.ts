import { Request, Response } from "express";
import { verifyService } from "../Service/verify.service"

export class verifyController {
  static verify = async (req: Request, res: Response) => {
    try {
      const payload = req.body;
      if (!payload.qrPayload || !payload.campaignId || !payload.sessionId) {
        return res.status(400).send({ message: "Missing required fields" });
      }
      
      const userSessionData = await verifyService.verifyQrPayload(payload);
      res.status(200).json(userSessionData);
    
    } catch (error: any) {
      console.error("Controller Error (Verify):", error);
      // (ส่ง Error Message ที่ Service (เช่น "QR Code นี้สำหรับ Session อื่น") กลับไป)
      res.status(400).send({ message: error.message });
    }
  };
}