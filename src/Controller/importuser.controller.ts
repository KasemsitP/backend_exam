import { Request, Response } from "express";
import { userImportService } from "../Service/importuser.service";

export class userImportController {
  static importUsers = async (req: Request, res: Response) => {
    try {
      const { rows } = req.body;
      const campaignId = parseInt(req.params.campaignId, 10);

      if (isNaN(campaignId)) {
        return res.status(400).send({ message: "Invalid Campaign ID" });
      }
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).send({ message: "No rows to import" });
      }
      const stats = await userImportService.importUsersToCampaign(
        campaignId,
        rows
      );
      res.status(201).json(stats);
    } catch (error: any) {
      console.error("Import Error (Controller):", error);
      res.status(500).send({ message: error.message });
    }
  };
}

