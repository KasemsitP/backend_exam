"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailTemplate = emailTemplate;
// src/utils/emailtheme.ts
function emailTemplate(otp, opts) {
    var _a;
    const appName = (_a = opts === null || opts === void 0 ? void 0 : opts.appName) !== null && _a !== void 0 ? _a : "Exam Console";
    const email = opts === null || opts === void 0 ? void 0 : opts.email;
    return `
  <!DOCTYPE html>
  <html lang="th">
  <head>
    <meta charset="UTF-8" />
    <title>รหัส OTP สำหรับเข้าสู่ระบบ</title>
    <meta name="viewport" content="width=device-width,initial-scale=1" />
  </head>
  <body style="margin:0;padding:0;background-color:#F3F4F6;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#F3F4F6;padding:24px 0;">
      <tr>
        <td align="center">
          <!-- กล่องหลัก -->
          <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:480px;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E5E7EB;">
            <!-- Header แถบบน -->
            <tr>
              <td style="background:linear-gradient(135deg,#1D4ED8,#3B82F6);padding:16px 24px;">
                <table width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td align="left">
                      <span style="display:inline-block;font-size:14px;color:#BFDBFE;letter-spacing:.08em;text-transform:uppercase;">
                        Security Code
                      </span>
                      <div style="font-size:20px;font-weight:600;color:#ffffff;margin-top:4px;">
                        รหัส OTP สำหรับเข้าสู่ระบบ
                      </div>
                    </td>
                    <td align="right" style="font-size:13px;color:#DBEAFE;">
                      ${appName}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- เนื้อหา -->
            <tr>
              <td style="padding:20px 24px 4px 24px;">
                <p style="margin:0 0 8px 0;font-size:15px;color:#111827;">
                  สวัสดีครับ/ค่ะ${email ? ` <strong>${email}</strong>` : ""} 👋
                </p>
                <p style="margin:0 0 12px 0;font-size:14px;color:#4B5563;line-height:1.5;">
                  นี่คือรหัสยืนยันแบบใช้ครั้งเดียว (OTP) สำหรับเข้าสู่ระบบ <strong>${appName}</strong>
                </p>
              </td>
            </tr>

            <!-- กล่อง OTP -->
            <tr>
              <td align="center" style="padding:8px 24px 4px 24px;">
                <table border="0" cellspacing="0" cellpadding="0" style="margin:16px auto;">
                  <tr>
                    <td style="
                      font-size:32px;
                      letter-spacing:.4em;
                      font-weight:700;
                      color:#111827;
                      padding:12px 24px;
                      border-radius:999px;
                      background-color:#F9FAFB;
                      border:1px solid #E5E7EB;
                    ">
                      ${otp.split("").join(" ")}
                    </td>
                  </tr>
                </table>
                <div style="font-size:12px;color:#6B7280;margin-top:4px;">
                  รหัสนี้มีอายุประมาณ <strong>5 นาที</strong> และใช้ได้เพียงครั้งเดียว
                </div>
              </td>
            </tr>

            <!-- คำแนะนำ -->
            <tr>
              <td style="padding:16px 24px 8px 24px;">
                <p style="margin:0 0 8px 0;font-size:13px;color:#4B5563;line-height:1.5;">
                  หากคุณไม่ได้ร้องขอรหัสนี้ สามารถเพิกเฉยต่ออีเมลฉบับนี้ได้โดยปลอดภัย
                </p>
                <p style="margin:0;font-size:12px;color:#9CA3AF;line-height:1.5;">
                  เพื่อความปลอดภัย กรุณาอย่าบอกรหัส OTP นี้กับผู้อื่นหรือพิมพ์รหัสนี้ในเว็บไซต์ที่ไม่น่าเชื่อถือ
                </p>
              </td>
            </tr>

            <!-- Footer เล็กๆ -->
            <tr>
              <td style="padding:16px 24px 20px 24px;border-top:1px solid #F3F4F6;">
                <p style="margin:0;font-size:11px;color:#9CA3AF;">
                  อีเมลนี้ถูกส่งโดยระบบอัตโนมัติ กรุณาอย่าตอบกลับอีเมลฉบับนี้
                </p>
              </td>
            </tr>
          </table>

          <!-- ลิงก์เล็กๆ ด้านล่าง -->
          <div style="margin-top:12px;font-size:11px;color:#9CA3AF;">
            © ${new Date().getFullYear()} ${appName}
          </div>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;
}
