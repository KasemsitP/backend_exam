
import { Request, Response } from "express"
import { bagservice } from "../Service/bag.service";
export class bagcontroller {
    static getBags = async (req: Request, res: Response) => {
        try {
            const result = await bagservice.getBagByCampaign(req)
           res.status(201).json(result);
        } catch (error: any) {
            // console.log(error)
            return res.status(400).send({ message: error.message });
        }
    }
    static getCountBags = async (req: Request, res: Response) => {
        try {
            const result = await bagservice.CountBagByCampaign(req)
            res.status(201).json(result);
        } catch (error: any) {
            // console.log(error)
            return res.status(400).send({ message: error.message });
        }
    }
    static insertBag = async (req: Request, res: Response) => {
        try {
            const result = await bagservice.insertBagsCheck(req)
            res.status(201).json({ message: "บันทึกข้อมูลสำเร็จ" });
        } catch (error: any) {
            // console.log(error)
            return res.status(400).send({ message: error.message });
        }
    }
}
