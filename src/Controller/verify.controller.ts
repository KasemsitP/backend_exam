import { Request, Response } from "express";
import { verifyService } from "../Service/verify.service"

export class verifyController {
    static verify = async (req: Request, res: Response) => {
        try {
            const payload = req.body;
            if (!payload.qrPayload) {
                return res.status(400).send({ success: false, message: "Missing required fields" });
            }
            console.log("Received QR Payload:", payload.qrPayload);

            const userSessionData = await verifyService.verifyQrPayload(payload);
            console.log(userSessionData)
            res.status(200).json(userSessionData);

        } catch (error: any) {
            console.error("Controller Error (Verify):", error);
            // (ส่ง Error Message ที่ Service (เช่น "QR Code นี้สำหรับ Session อื่น") กลับไป)
            res.status(400).send({ success: false, message: error.message });
        }
    };
    static CheckBookletsOrders = async (req: Request, res: Response) => {
        try {
            const { campaignId, qrPayload, innitialCode } = req.body
            const bookletsId = parseInt(innitialCode)
            if (!qrPayload || !campaignId || !bookletsId) {
                return res.status(400).send({ success: false, message: "ข้อมูลไม่ครบถ้วน" });
            }
            const userSessionData = await verifyService.checkBookletsOrders(campaignId, qrPayload, bookletsId);
            res.status(200).json(userSessionData);

        } catch (error: any) {
            console.error("Controller Error (Verify):", error);
            // (ส่ง Error Message ที่ Service (เช่น "QR Code นี้สำหรับ Session อื่น") กลับไป)
            res.status(400).send({ success: false, message: error.message });
        }
    };
}