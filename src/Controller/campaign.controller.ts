import { Request, Response } from "express";
import { campaignService } from "../Service/campaign.service";
import { CreateCampaignPayload } from "../Repo/campaign.repo";

export class campaignController {
  static create = async (req: Request, res: Response) => {
    try {
      const payload: CreateCampaignPayload = req.body;
      console.log(payload)
      const newCampaign = await campaignService.create(payload);
      res.status(201).json(newCampaign);

    } catch (error: any) {
      res.status(400).send({ message: error.message });
    }
  };
  static update = async (req: Request, res: Response) => {
    try {
      const payload: CreateCampaignPayload = req.body;
      const updatedCampaign = await campaignService.update(payload);
      res.status(201).json(updatedCampaign);

    } catch (error: any) {
      res.status(400).send({ message: error.message });
    }
  };

  static delete = async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).send({ message: "Invalid ID format" });
      }

      await campaignService.delete(id);
      res.status(204).send();

    } catch (error: any) {
      res.status(400).send({ message: error.message });
    }
  };
  static getIsUnlock = async (req: Request, res: Response) => {
    try {
      const { campaign_id } = req.params;

      if (!campaign_id) {
        return res.status(400).json({ message: "no campaign_id" });
      }

      const isUnlock = await campaignService.getIsUnlock(Number(campaign_id));

      return res.status(200).json({
        success: true,
        isUnlock,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err.message || "Internal server error",
      });
    }
  };

}
