import { Router } from "express";
import { bagController } from "../Controller/bag.controller";


const bagRouter = Router();

bagRouter.post("/bags/bulk-create", bagController.bulkCreate);
bagRouter.post("/bags/finalize-and-link", bagController.finalizeAndLink);
bagRouter.get("/bags/campaign/:campaignId", bagController.getAllForCampaign);
bagRouter.delete("/bags/:bagId", bagController.deleteById);



export default bagRouter;
