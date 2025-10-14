import express from "express";
import { isAuthenticated } from "../Middleware/authentication";
import { bagcontroller } from "../Controller/ิbag.controller";
const router = express.Router();

router.get("/bags",bagcontroller.getBags)
router.get("/countbags",bagcontroller.getCountBags)
router.post("/insertbag",bagcontroller.insertBag)



export default router;




