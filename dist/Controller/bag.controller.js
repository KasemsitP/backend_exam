"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.bagController = void 0;
const bag_service_1 = require("../Service/bag.service");
const grader_work_lock_service_1 = require("../Service/grader-work-lock.service");
class bagController {
}
exports.bagController = bagController;
_a = bagController;
bagController.bulkCreate = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const payload = req.body;
        // (ควรมีการ Validation Payload)
        if (!payload.campaignId || !payload.sessionId || !payload.prefix || !payload.count || !payload.capacity) {
            return res.status(400).send({ message: "Missing required fields for bulk create" });
        }
        const newBags = yield bag_service_1.bagService.bulkCreate(payload);
        res.status(201).json(newBags);
    }
    catch (error) {
        res.status(500).send({ message: error.message });
    }
});
bagController.CreateBagAndBooklets = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { campaignId, payload, datetime, bagNo } = req.body;
        if (!campaignId || !payload || !datetime || !bagNo) {
            return res.status(400).send({ message: "ข้อมูลไม่ครบ" });
        }
        const dateTimes = datetime.map((d) => new Date(d));
        const result = yield bag_service_1.bagService.CreateBagAndUpdateBooklets(campaignId, payload, dateTimes, bagNo);
        return res.status(200).json(result);
    }
    catch (error) {
        res.status(500).send({ message: error.message });
    }
});
bagController.CheckSubjectBooklets = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { campaignId, payload, datetime } = req.body;
        if (!campaignId || !payload || !datetime) {
            return res.status(400).send({ message: "ข้อมูลไม่ครบ" });
        }
        const dateTimes = datetime.map((d) => new Date(d));
        const result = yield bag_service_1.bagService.CheckbookletsSubjects(campaignId, payload, dateTimes);
        return res.status(200).json(result);
    }
    catch (error) {
        res.status(500).send({ message: error.message });
    }
});
bagController.createPDF = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { bag_id } = req.params;
        if (!bag_id) {
            return res
                .status(400)
                .json({ message: "Invalid Bag ID" });
        }
        // const course = String(req.query.course ?? "วิชาไม่ระบุ");
        // const org = String(req.query.org ?? "");
        // const sessionText = String(req.query.sessionText ?? "");
        const pdfBuffer = yield bag_service_1.bagService.generateBagPayloadPdfByBagId(Number(bag_id));
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="signsheet_${bag_id}.pdf"`);
        res.send(pdfBuffer);
    }
    catch (err) {
        console.error("generate sign sheet pdf error:", err);
        res.status(500).json({ message: "ไม่สามารถสร้าง PDF ได้" });
    }
});
bagController.createPDFByCampaignId = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const campaignId = req.query.campaign_id
            ? Number(req.query.campaign_id)
            : null;
        const sessionId = req.query.session_id
            ? Number(req.query.session_id)
            : null;
        if (!campaignId && !sessionId) {
            return res.status(400).json({
                message: "ต้องส่ง campaign_id หรือ session_id",
            });
        }
        if (campaignId && sessionId) {
            return res.status(400).json({
                message: "ส่งได้แค่ campaign_id หรือ session_id อย่างใดอย่างหนึ่ง",
            });
        }
        let pdfBuffer;
        let filename;
        if (campaignId) {
            pdfBuffer =
                yield bag_service_1.bagService.generateBagPayloadAllPdfByCampaignId(campaignId);
            filename = `signsheet_campaign_${campaignId}.pdf`;
        }
        else {
            pdfBuffer =
                yield bag_service_1.bagService.generateBagPayloadAllPdfBySessionId(sessionId);
            filename = `signsheet_session_${sessionId}.pdf`;
        }
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        return res.send(pdfBuffer);
    }
    catch (err) {
        console.error("generate sign sheet pdf error:", err);
        return res.status(500).json({ message: "ไม่สามารถสร้าง PDF ได้" });
    }
});
// static InsertBooklets = async (req: Request, res: Response) => {
//   try {
//     const payload = req.body;
//     console.log(payload)
//     if (!payload.campaignId || !payload.bag_no || !payload.scannedCodes) {
//       //console.log(payload)
//       return res.status(400).send({ message: "ข้อมูลไม่ครบ" });
//     }
//     // console.log(payload, "lnw")
//     const result = await bagService.InsertBooklets(payload)
//     res.status(200).json(result);
//   } catch (error: any) {
//     console.error("Controller Error (Finalize & Link):", error);
//     res.status(400).send({ message: error.message });
//   }
// };
bagController.getAllForCampaign = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const campaignId = req.params.campaignId;
        if (!campaignId) {
            return res.status(400).send({ message: "Missing Campaign ID" });
        }
        const bags = yield bag_service_1.bagService.getAllByCampaignId(campaignId);
        res.status(200).json(bags);
    }
    catch (error) {
        res.status(500).send({ message: error.message });
    }
});
bagController.deleteById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const bagId = req.params.bagId;
        if (!bagId) {
            return res.status(400).send({ message: "Missing Bag ID" });
        }
        const result = yield bag_service_1.bagService.deleteById(Number(bagId));
        console.log(result);
        res.status(200).json(result);
    }
    catch (error) {
        res.status(500).send({ message: error.message });
    }
});
bagController.getBookletsInBag = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    //console.log("HIT /api/bags/:bagNo/booklets", req.params, req.query);
    try {
        console.log("HIT /api/bags/:bagNo/booklets", req.params, req.query);
        const bagNo = Number(req.params.bagNo);
        const campaignId = Number(req.query.campaignId);
        const sessionId = Number(req.query.sessionId);
        if (!bagNo || !campaignId || !sessionId) {
            return res.status(400).send({ message: "ข้อมูลไม่ครบ" });
        }
        const list = yield bag_service_1.bagService.getBookletsInBag({
            campaignId,
            sessionId,
            bagNo,
        });
        console.log(list);
        res.json(list);
    }
    catch (err) {
        console.error("Controller Error (getBookletsInBag):", err);
        res.status(500).send({ message: err.message || "ไม่สามารถดึงข้อมูลถุงได้" });
    }
});
bagController.getBookScannedCount = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const campaignId = Number(req.params.campaignId);
        if (!campaignId) {
            return res.status(400).send({ message: "ข้อมูลไม่ครบ" });
        }
        const list = yield bag_service_1.bagService.getBookScannedCount({
            campaignId,
        });
        res.json(list);
    }
    catch (err) {
        //  console.error("Controller Error (getBookletsInBag):", err);
        res.status(500).send({ message: err.message || "เกิดข้อผิดพลาด" });
    }
});
bagController.getBagActiveGrader = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const campaignId = Number(req.params.campaignId);
        if (!campaignId) {
            return res.status(400).send({ message: "ข้อมูลไม่ครบ" });
        }
        const list = yield grader_work_lock_service_1.GraderWorkLockSerivce.getBagActiveGrader(campaignId);
        return res.status(200).json(list);
    }
    catch (err) {
        res.status(500).send({ message: err.message || "เกิดข้อผิดพลาด" });
    }
});
