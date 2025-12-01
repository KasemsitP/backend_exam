"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bag_controller_1 = require("../Controller/bag.controller");
const bagRouter = (0, express_1.Router)();
bagRouter.post("/bags/bulk-create", bag_controller_1.bagController.bulkCreate);
bagRouter.post("/bags/finalize-and-link", bag_controller_1.bagController.InsertBooklets);
bagRouter.get("/bags/campaign/:campaignId", bag_controller_1.bagController.getAllForCampaign);
bagRouter.delete("/bags/:bagId", bag_controller_1.bagController.deleteById);
bagRouter.get("/lnwza", (req, res) => {
    console.log("HIT /lnwza");
    res.send("OK /lnwza");
});
exports.default = bagRouter;
