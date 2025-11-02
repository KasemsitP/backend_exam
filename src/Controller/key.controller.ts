import { Request, Response } from "express";
import { keyService } from "../Service/key.service";

export class keyController {
  /**
   * [ GET (เหมือนเดิม) ]
   */
  static getAllForCampaign = async (req: Request, res: Response) => {
    try {
      const campaignId = parseInt(req.params.campaignId, 10);
      if (isNaN(campaignId)) {
        return res.status(400).send({ message: "Invalid Campaign ID" });
      }
      const keys = await keyService.getAllForCampaign(campaignId);
      res.status(200).json(keys);
    } catch (error: any) {
      res.status(500).send({ message: error.message });
    }
  };

  /**
   * [ ⭐️ POST (แก้ไข) ⭐️ ]
   * (keyAlias -> key)
   */
  static create = async (req: Request, res: Response) => {
    try {
      const { campaignId, key } = req.body; // [ ⭐️ FIX ⭐️ ]

      if (!campaignId || !key) { // [ ⭐️ FIX ⭐️ ]
        return res
          .status(400)
          .send({ message: "Missing campaignId or key" }); // [ ⭐️ FIX ⭐️ ]
      }

      const keyData = await keyService.create(campaignId, key); // [ ⭐️ FIX ⭐️ ]
      res.status(201).json(keyData);
    } catch (error: any) {
      if (error.message.includes("Key limit")) {
        return res.status(409).send({ message: error.message });
      }
      res.status(500).send({ message: error.message });
    }
  };

  /**
   * [ DELETE (เหมือนเดิม) ]
   */
  static delete = async (req: Request, res: Response) => {
    try {
      const keyId = parseInt(req.params.id, 10);
      if (isNaN(keyId)) {
        return res.status(400).send({ message: "Invalid Key ID" });
      }
      await keyService.delete(keyId);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).send({ message: error.message });
    }
  };
static getPrerequisites = async (req: Request, res: Response) => {
    try {
      const campaignId = parseInt(req.params.campaignId, 10);
      if (isNaN(campaignId)) {
        return res.status(400).send({ message: "Invalid Campaign ID" });
      }
      const status = await keyService.getPrerequisites(campaignId);
      res.status(200).json(status);
    } catch (error: any) {
      res.status(500).send({ message: error.message });
    }
  };

  /**
   * [ ⭐️ POST (แก้ไข) ⭐️ ]
   * @desc POST /api/keys/encrypt-session-bulk
   */
  static runBulkEncryption = async (req: Request, res: Response) => {
    try {
      // ( 1. รับแค่ campaignId, sessionId )
      const { campaignId, sessionId } = req.body;
      if (!campaignId || !sessionId) {
        return res
          .status(400)
          .send({ message: "Missing campaignId or sessionId" });
      }

      // 2. ส่งต่อให้ Service (สมอง)
      const stats = await keyService.runBulkEncryptionForSession(
        campaignId,
        sessionId
      );
      
      // 3. ส่งผลลัพธ์ (Stats) กลับไป
      res.status(200).json(stats); // (เช่น { usersEncrypted: 150 })
    } catch (error: any) {
      if (
        error.message.includes("Key") ||
        error.message.includes("User session")
      ) {
        return res.status(400).send({ message: error.message });
      }
      res.status(500).send({ message: error.message });
    }
  };
}

