import { Request, Response } from "express";
import { bagService } from "../Service/bag.service";


export class bagController {

    static bulkCreate = async (req: Request, res: Response) => {
        try {
            const payload = req.body;
            // (ควรมีการ Validation Payload)
            if (!payload.campaignId || !payload.sessionId || !payload.prefix || !payload.count || !payload.capacity) {
                return res.status(400).send({ message: "Missing required fields for bulk create" });
            }
  
            const newBags = await bagService.bulkCreate(payload);
            res.status(201).json(newBags);
        } catch (error: any) {
            res.status(500).send({ message: error.message });
        }
    };


    static InsertBooklets = async (req: Request, res: Response) => {
        try {
            const payload = req.body;
             console.log(payload)
            if (!payload.campaignId || !payload.bag_no || !payload.scannedCodes) {
                //console.log(payload)
                return res.status(400).send({ message: "ข้อมูลไม่ครบ" });
            }
           // console.log(payload, "lnw")
            const result = await bagService.InsertBooklets(payload)
            res.status(200).json(result);

        } catch (error: any) {
            console.error("Controller Error (Finalize & Link):", error);
            res.status(400).send({ message: error.message });
        }
    };
    static getAllForCampaign = async (req: Request, res: Response) => {
        try {

            const campaignId = req.params.campaignId;
            if (!campaignId) {
                return res.status(400).send({ message: "Missing Campaign ID" });
            }
            const bags = await bagService.getAllByCampaignId(campaignId);
            res.status(200).json(bags);
        } catch (error: any) {
            res.status(500).send({ message: error.message });
        }
    };
    static deleteById = async (req: Request, res: Response) => {
        try {
            const bagId = req.params.bagId;
            if (!bagId) {
                return res.status(400).send({ message: "Missing Bag ID" });
            }
            const result = await bagService.deleteById(bagId);
            console.log(result)
            res.status(200).json(result);
        } catch (error: any) {
            res.status(500).send({ message: error.message });
        }
    };
  static getBookletsInBag = async (req: Request, res: Response) => {
    //console.log("HIT /api/bags/:bagNo/booklets", req.params, req.query);
    try {
      const bagNo = Number(req.params.bagNo);
      const campaignId = Number(req.query.campaignId);
      const sessionId = Number(req.query.sessionId);

      if (!bagNo || !campaignId || !sessionId) {
        return res.status(400).send({ message: "ข้อมูลไม่ครบ" });
      }

      const list = await bagService.getBookletsInBag({
        campaignId,
        sessionId,
        bagNo,
      });

      res.json(list);
    } catch (err: any) {
      console.error("Controller Error (getBookletsInBag):", err);
      res.status(500).send({ message: err.message || "ไม่สามารถดึงข้อมูลถุงได้" });
    }
  };

  static getBookScannedCount = async (req: Request, res: Response) => {
    try {
      const campaignId = Number(req.params.campaignId);

      if ( !campaignId ) {
        return res.status(400).send({ message: "ข้อมูลไม่ครบ" });
      }

      const list = await bagService.getBookScannedCount({
        campaignId,
      });

      res.json(list);
    } catch (err: any) {
    //  console.error("Controller Error (getBookletsInBag):", err);
      res.status(500).send({ message: err.message || "เกิดข้อผิดพลาด" });
    }
  };
}
