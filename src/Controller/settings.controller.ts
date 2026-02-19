import { Request, Response } from "express";
import { SettingService } from "../Service/settings.service";

export class SettingsController {
    static updateActiveCamp = async (req: Request, res: Response) => {
        try {
            const { campaign_id } = req.params
            if (!campaign_id) {
                return res.status(400).send({ success: false, message: "ไม่พบรหัสรอบสอบ" });
            }

            const result = await SettingService.ActiveInActiveCampaign(Number(campaign_id));
            console.log(result)
            res.status(200).json({ success: true, message: "รอบสอบถูกเปิดหรือปิดการใช้งานแล้ว" });

        } catch (error: any) {
            console.error("ไม่สามารถเปิดใช้รอบสอบได้", error);
            res.status(400).send({ success: false, message: error.message });
        }
    };
    static updateActiveKeys = async (req: Request, res: Response) => {
        try {
            const { campaign_id } = req.params
            if (!campaign_id) {
                return res.status(400).send({ success: false, message: "ไม่พบรหัสรอบสอบ" });
            }
            const result = await SettingService.ActiveInActiveQR(Number(campaign_id));
            console.log(result)
            res.status(200).json({ success: true, message: "คิวอาร์โค้ดที่เปิดหรือปิดการใช้งานแล้ว" });

        } catch (error: any) {
            console.error("ไม่สามารถเปิดใช้รอบสอบได้", error);
            res.status(400).send({ success: false, message: error.message });
        }
    };

    static getSettingStatus = async (req: Request, res: Response) => {
        try {
            const { campaign_id } = req.params
            if (!campaign_id) {
                return res.status(400).send({ success: false, message: "ไม่พบรหัสรอบสอบ" });
            }
            const result = await SettingService.getSettingStatus(Number(campaign_id));
            console.log(result)
            res.status(200).json({ success: true, data: result });

        } catch (error: any) {
            console.error("ไม่สามารถเปิดใช้รอบสอบได้", error);
            res.status(400).send({ success: false, message: error.message });
        }
    };
}