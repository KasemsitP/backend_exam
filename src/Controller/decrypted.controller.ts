import { Request, Response } from "express";
import { CampaignDecryptService } from "../Service/decrypt.service";

export class decryptedController {
    static decryptedUnlock = async (req: Request, res: Response) => {
        try {
            const { campaignId } = req.params;
            const { FirstKey , SecondKey } = req.body;
            if (!campaignId) {
                return res.status(400).send({ message: "ไม่พบ campaign_id" });
            }
            const result_decrypt = await CampaignDecryptService.decryptedUnlock(Number(campaignId), FirstKey, SecondKey);
            res.status(201).json(result_decrypt);

        } catch (error: any) {
            res.status(400).send({ message: error.message });
        }
    };

}
