import { Request, Response } from "express";
import { examDataService } from "../Service/exam.service";

export class examDataController {
  static getInitialData = async (req: Request, res: Response) => {
    try {
      const data = await examDataService.getInitialData();
      res.status(200).json(data);
    } catch (error: any) {
      res.status(500).send({ message: error.message });
    }
  };
  static getCampaignNoactive = async (req: Request, res: Response) => {
    try {
      const data = await examDataService.getCampaignNoactive();
      res.status(200).json(data);
    } catch (error: any) {
      res.status(500).send({ message: error.message });
    }
  };
  static ActiveInActiveCampaign = async (req: Request, res: Response) => {
    const {campaign_id } = req.params
    try {
      const data = await examDataService.ActiveInActiveCampaign(Number(campaign_id));
      res.status(200).json({ message: "sucess" });
    } catch (error: any) {
      res.status(500).send({ message: error.message });
    }
  };
}