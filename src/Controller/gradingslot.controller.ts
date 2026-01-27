import { Request, Response } from "express";
import { gradingService } from "../Service/gradingslot.service";

export class gradingslotController {
  static CreateSlot = async (req: Request, res: Response) => {
    try {
      const { qrPayload, campaignId,  graderId  , questionNo} = req.body;

      if (!qrPayload || !campaignId ||  !graderId || !questionNo) {
        return res.status(400).send({ message: "ข้อมูลไม่ครบ" });
      }

      // 1) ถอด QR + หา booklet_subject_id ให้ตรงกับคนที่สอบใบนี้จริง ๆ
      // const decypted = await keyService.decryptQrPayload(qrPayload, parseInt(campaignId));
      // if (!decypted || !decypted.uid) {
      //   return res.status(400).send({ message: "QR Code ไม่ถูกต้อง หรือถอดรหัสล้มเหลว" });
      // }
      // console.log("Decrypted Payload:", decypted);

      const result = await gradingService.createSlotFromQr({
        qrPayload,
        campaignId: Number(campaignId),
        graderId: Number(graderId),
        questionNo: Number(questionNo)
      });

      res.status(201).json(result);

    //   // 3) ส่งผลลัพธ์กลับไปให้ frontend
    //   res.status(201).json(result);
    } catch (error: any) {
      res.status(400).send({ message: error.message });
    }
  };
}