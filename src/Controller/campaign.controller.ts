import { Request, Response } from "express";
import { campaignService } from "../Service/campaign.service";
import { CreateCampaignPayload } from "../Repo/campaign.repo";

export class campaignController {
  static create = async (req: Request, res: Response) => {
    try {
      const payload: CreateCampaignPayload = req.body;
      const newCampaign = await campaignService.create(payload);
      res.status(201).json(newCampaign); 
      
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
}
