// routes/campaignDecrypt.route.ts (ตัวอย่าง)
import express from "express";
//import { requireAdminOrManager } from "../middleware/auth";
import { CampaignDecryptService } from "../Service/decrypt.service";

const router = express.Router();

// POST /api/campaigns/:id/decrypt/request-otp
router.post(
  "/campaigns/:id/decrypt/request-otp",
  async (req, res) => {
    const campaignId = Number(req.params.id);
    const { FirstKey, SecondKey } = req.body;
    const accountId = Number(req.session.userId); // หรือดึงจาก auth middleware

    console.log(FirstKey , SecondKey)

    const firstKey = FirstKey
    const secondKey = SecondKey
   // console.log(firstKey , secondKey)


    try {
      const result = await CampaignDecryptService.requestOtp({
        campaignId,
        accountId,
        firstKey,
        secondKey,
      });

      return res.json({
        success: true,
        step: "OTP_SENT",
        sentTo: result.sentToMasked,
        expiresAt: result.expiresAt,
        otpToken: result.otpToken
      });
    } catch (err: any) {
      console.error(err);
      return res.status(400).json({
        success: false,
        message: err.message || "ไม่สามารถเริ่มการถอดรหัสได้",
      });
    }
  }
);

router.post("/campaigns/:id/decrypt/verify-otp", async (req, res) => {
  const campaignId = Number(req.params.id);
  const accountId = Number(req.session.userId);
  const { otpToken, otpCode } = req.body;  // ✅ ให้ตรงกับ frontend

  if (!otpToken || !otpCode) {
    return res.status(400).json({
      success: false,
      message: "ข้อมูล OTP ไม่ครบ",
    });
  }
  console.log(otpToken , otpCode)

  try {
    await CampaignDecryptService.verifyOtpAndUnlock({
      campaignId,
      accountId,
      otpToken,
      otpCode, //  ให้ service ไปตรวจ
    });

    return res.json({
      success: true,
      message: "ปลดล็อคแคมเปญสำเร็จ",
    });
  } catch (err: any) {
    console.error(err);
    return res.status(400).json({
      success: false,
      message: err.message || "OTP ไม่ถูกต้อง หรือหมดอายุ",
    });
  }
});

export default router;
