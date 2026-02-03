// services/campaignDecrypt.service.ts
import { DB } from "../model/DB";
import bcrypt from "bcrypt";
import { sendMail } from "../utills/mail"; // แล้วแต่คุณใช้ lib อะไร
import crypto from "crypto";

export class CampaignDecryptService {
    static async requestOtp(opts: {
        campaignId: number;
        accountId: number;
        firstKey: string;
        secondKey: string;
    }) {
        const { campaignId, accountId, firstKey, secondKey } = opts;
        const conn = await DB.getInstance().getConnection();
        try {
            // 1) ดึง key 1/2 ของ campaign นี้
            const [rows] = await conn.query<any[]>(
                `
        SELECT id, \`key\`, order_num
        FROM campaign_keys
        WHERE campaign_id = ? AND active = 1
        ORDER BY order_num ASC
        `,
                [campaignId]
            );

            if (rows.length < 2) {
                throw new Error("แคมเปญนี้ยังไม่ได้สร้างคีย์ครบ 2 ดอก");
            }

            const key1 = rows.find((r) => r.order_num === 1);
            const key2 = rows.find((r) => r.order_num === 2);

            if (!key1 || !key2) {
                throw new Error("โครงสร้างคีย์ของแคมเปญนี้ไม่ถูกต้อง");
            }

            // 2) ตรวจว่า key ตรงไหม
            if (key1.key !== firstKey || key2.key !== secondKey) {
                throw new Error("คีย์เข้ารหัสไม่ถูกต้อง");
            }

            // 3) เอา email ของ account ไปส่ง OTP
            const [accRows] = await conn.query<any[]>(
                `SELECT email, full_name FROM accounts WHERE id = ?`,
                [accountId]
            );
            if (!accRows.length || !accRows[0].email) {
                throw new Error("ไม่พบอีเมลของผู้ใช้งาน");
            }

            const email = accRows[0].email as string;

            // 4) สร้าง OTP 6 หลัก + hash
            const otp = (Math.floor(Math.random() * 900000) + 100000).toString();
            const otpHash = await bcrypt.hash(otp, 10);
            const otpToken = crypto.randomUUID();

            const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 นาที

            // 5) insert twofactor_sessions
            await conn.query(
                `
  INSERT INTO twofactor_sessions
    (account_id, campaign_id, purpose, otp_token, otp_hash, expires_at, attempts)
  VALUES (?, ?, 'DECRYPT_CAMPAIGN', ?, ?, ?, 0)
  `,
                [accountId, campaignId, otpToken, otpHash, expiresAt]
            );

            // 6) ส่ง email
            await sendMail({
                to: email,
                subject: `รหัสยืนยันการถอดรหัสแคมเปญ #${campaignId}`,
                text: `รหัสยืนยันของคุณคือ ${otp} (หมดอายุใน 10 นาที)`,
            });

            const maskEmail = email.replace(/(.{2}).+(@.*)/, "$1***$2");

            return {
                sentToMasked: maskEmail,
                expiresAt: expiresAt.toISOString(),
                otpToken, // ✅ ส่ง token ไม่ใช่ hash
            };
        } finally {
            conn.release();
        }
    }
    static async verifyOtpAndUnlock(opts: {
        campaignId: number;
        accountId: number;
        otpToken: string;
        otpCode: string;
    }) {
        const { campaignId, accountId, otpCode, otpToken } = opts;
        const conn = await DB.getInstance().getConnection();

        try {
            // ===== 0) เปิด Transaction กัน race condition =====
            await conn.beginTransaction();

            // ===== 1) ดึง OTP ล่าสุดของ user + campaign นี้ ที่ยังไม่ใช้ (ล็อคแถวไว้) =====
            const [rows] = await conn.query<any[]>(
                `
  SELECT id, otp_hash, expires_at, used_at, attempts
  FROM twofactor_sessions
  WHERE account_id = ?
    AND campaign_id = ?
    AND otp_token = ?
    AND purpose = 'DECRYPT_CAMPAIGN'
  LIMIT 1
  FOR UPDATE
  `,
                [accountId, campaignId, otpToken]
            );


            if (!rows.length) {
                throw new Error("OTP session ไม่ถูกต้อง");
            }

            const rec = rows[0];

            if (rec.used_at) throw new Error("รหัสนี้ถูกใช้ไปแล้ว");
            if (new Date(rec.expires_at).getTime() < Date.now())
                throw new Error("รหัสยืนยันหมดอายุแล้ว");
            if (rec.attempts >= 5)
                throw new Error("กรอกรหัสผิดเกินจำนวนครั้งที่กำหนด");

            // ===== 2) เช็ค OTP =====
            const ok = await bcrypt.compare(otpCode, rec.otp_hash);

            if (!ok) {
                await conn.query(
                    `UPDATE twofactor_sessions SET attempts = attempts + 1 WHERE id = ?`,
                    [rec.id]
                );

                await conn.commit();
                throw new Error("รหัสยืนยันไม่ถูกต้อง");
            }

            // ===== 3) OTP ถูก → mark ใช้แล้ว + ปลดล็อคแคมเปญ =====
            await conn.query(
                `
        UPDATE twofactor_sessions
        SET used_at = NOW(),
            attempts = attempts + 1
        WHERE id = ?
  AND used_at IS NULL
        `,
                [rec.id]
            );

            await conn.query(
                `
        UPDATE exam_campaigns
        SET is_unlock = 1
        WHERE id = ?
        `,
                [campaignId]
            );

            // ถ้าต้องการล็อคเฉพาะ campaign นี้ (ไม่เกี่ยวกับ campaign อื่น) แบบนี้โอเคแล้ว

            await conn.commit();
        } catch (err) {
            // ถ้า error ใด ๆ ให้ rollback ก่อน
            try {
                await conn.rollback();
            } catch {
                // ถ้า rollback fail ก็ข้ามได้
            }
            throw err;
        } finally {
            conn.release();
        }
    }
}
