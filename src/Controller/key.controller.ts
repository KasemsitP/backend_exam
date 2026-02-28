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
      const { campaignId, key, account_id, order_num } = req.body;

      if (!campaignId || !key || !account_id || !order_num) {
        return res
          .status(400)
          .send({ message: "Missing campaignId or key or order_num" });
      }

      const keyData = await keyService.create(campaignId, key, account_id, order_num);
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
      const keyId = parseInt(req.params.keyId, 10);
      const campaignId = parseInt(req.params.campaignId, 10);
      const accountId = parseInt(req.params.accountId, 10);
      console.log("keyId:", keyId, "campaignId:", campaignId, "accountId:", accountId);
      if (isNaN(keyId) || isNaN(campaignId) || isNaN(accountId)) {
        return res.status(400).send({ message: "Invalid Key ID, Campaign ID, or Account ID" });
      }
      await keyService.delete(keyId, campaignId, accountId);
      res.status(204).send({ message: "ลบคีย์สำเร็จแล้ว" });
    } catch (error: any) {
      res.status(500).send({ message: error.message });
      // console.log("Error in delete controller:", error);
    }
  };

  static getForgetKeys = async (req: Request, res: Response) => {
    try {
      const { campaignId, keyId, accountId, password } = req.body;

      if (!campaignId || !keyId || !accountId || !password) {
        return res.status(400).send({ message: "ข้อมูลไม่ถูกต้อง" });
      }
      const result = await keyService.delete(keyId, campaignId, accountId);
      res.status(204).send({ success: true, message: "กู้คีย์สำเร็จแล้ว", data: result });
    } catch (error: any) {
      res.status(500).send({ message: error.message });
      // console.log("Error in delete controller:", error);
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
      const { campaignId } = req.body;
      console.log(campaignId)
      if (!campaignId) {
        return res
          .status(400)
          .send({ message: "Missing campaignId or sessionId" });
      }

      const stats = await keyService.runBulkEncryptionForSession(
        campaignId,
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

      const decrypted = await keyService.decryptPayloadStaff(ciphertext, campaignId);
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
  static forgetKey = async (req: Request, res: Response) => {
    console.log("forgetKey controller called with body:", req.body);
    try {
      const { campaignId, keyId, accountId, password } = req.body;

      if (!campaignId || !keyId || !accountId || !password) {
        return res.status(400).send({ message: "ข้อมูลไม่ถูกต้อง" });
      }
      const result = await keyService.getForgetKey(campaignId, keyId, accountId, password);
      console.log("Forget Key Result:", result);
      res.status(200).send({ success: true, message: "กู้คีย์สำเร็จแล้ว", data: result });
    } catch (error: any) {
      res.status(500).send({ message: error.message });
       console.log("Error  controller:", error);
    }
  }
}