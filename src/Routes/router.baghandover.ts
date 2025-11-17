// src/Routes/router.baghandover.ts
import { Router } from "express";
import { BagHandoverController } from "../Controller/baghandover.controller";
// ถ้าต้องการ auth middleware ก็ import มาครอบภายหลังได้ เช่น isAuthenticated

const bagHandoverRouter = Router();

bagHandoverRouter.get(
  "/bag-handover/:campaignId",
  BagHandoverController.getForCampaign
);

bagHandoverRouter.post(
  "/bag-handover/check-in",
  BagHandoverController.checkIn
);

bagHandoverRouter.post(
  "/bag-handover/check-out",
  BagHandoverController.checkOut
);

export default bagHandoverRouter;
