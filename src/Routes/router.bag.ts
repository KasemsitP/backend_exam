import { Router } from "express";
import { bagController } from "../Controller/bag.controller";


const bagRouter = Router();

bagRouter.post("/bags/bulk-create", bagController.bulkCreate);
// bagRouter.post("/bags/finalize-and-link", bagController.InsertBooklets);

bagRouter.post("/bags/create-insert", bagController.CreateBagAndBooklets);
bagRouter.get("/bags/campaign/:campaignId", bagController.getAllForCampaign);
bagRouter.delete("/bags/:bagId", bagController.deleteById);
bagRouter.get(
  "/bags/:bagNo/booklets",
  bagController.getBookletsInBag
);

bagRouter.post("/bags/create-insert", bagController.CreateBagAndBooklets);

bagRouter.post("/bags/check-subjects", bagController.CheckSubjectBooklets);

bagRouter.get("/bags/scanned/:campaignId",bagController.getBookScannedCount)
export default bagRouter;
