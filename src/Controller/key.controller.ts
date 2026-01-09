import { Request, Response } from "express";
import { keyService } from "../Service/key.service";
import { parse } from "path";

export class keyController {

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

  static getAllForCampaignManager = async (req: Request, res: Response) => {
    try {
      const campaignId = parseInt(req.params.campaignId, 10);
      const AccountId = parseInt(req.params.AccountId, 10);
      if (isNaN(campaignId) || isNaN(AccountId)) {
        return res.status(400).send({ message: "Invalid Campaign ID  or Accoun ID" });
      }
      const keys = await keyService.getAllForCampaignManager(campaignId, AccountId);
      res.status(200).json(keys);
    } catch (error: any) {
      res.status(500).send({ message: error.message });
    }
  };

  /**
   * (keyAlias -> key)
   */
  static create = async (req: Request, res: Response) => {
    try {
      const { campaignId, key, account_id } = req.body;

      if (!campaignId || !key || !account_id) {
        return res
          .status(400)
          .send({ message: "Missing campaignId or key" });
      }

      const keyData = await keyService.create(campaignId, key, account_id);
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


  static runBulkEncryption = async (req: Request, res: Response) => {
    try {
      // ( 1. รับแค่ campaignId, sessionId )
      const { campaignId, sessionId } = req.body;
      console.log(campaignId , sessionId)
      if (!campaignId || !sessionId) {
        return res
          .status(400)
          .send({ message: "Missing campaignId or sessionId" });
      }

      const stats = await keyService.runBulkEncryptionForSession(
        campaignId,
        sessionId
      );

      res.status(200).json(stats);
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

  static testDecrypt = async (req: Request, res: Response) => {
    try {
      const { ciphertext, campaignId } = req.body;
      if (!ciphertext || !campaignId) {
        return res.status(400).send({ message: "Missing ciphertext or campaignId" });
      }

      const decrypted = await keyService.decryptQrPayload(ciphertext, campaignId);
      res.status(200).json(decrypted);
    } catch (error: any) {
      res.status(500).send({ message: error.message });
    }
  };

  static getDashboard = async (req: Request, res: Response) => {
    try {
      const campaignId = Number(req.params.campaignId);
      if (Number.isNaN(campaignId)) {
        return res.status(400).json({ message: "invalid campaign id" });
      }
      const data = await keyService.GetDashBoard(campaignId);

      return res.json(data);
    } catch (err) {
      console.error("getDashboard error:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  };

}

