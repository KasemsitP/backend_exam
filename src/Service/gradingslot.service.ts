// src/Service/gradingslot.service.ts
import { DB } from "../model/DB";
import gradingslotRepo from "../Repo/gradingslot.repo";
import { keyService } from "./key.service";

interface CreateSlotFromQrPayload {
  qrPayload: string;
  campaignId: number;
  sessionId: number;
  subjectId: number;
  questionNo: number;
  graderId: number;
}

// แยก type สำหรับ allocateSlot เผื่ออยากใช้ที่อื่นด้วย
interface AllocateSlotParams {
  bookletSubjectId: number;
  questionNo: number;
  graderId: number;
}

export class gradingService {
  /**
   * STEP 1: decode QR + หา booklet_subject_id จาก cid, sid, uid, subjectId
   * STEP 2: ใช้ allocateSlotForQuestion สร้าง grading_slot ตาม rule:
   *   - ยังไม่มี slot => grader_order = 1
   *   - มีแล้ว 1 slot (ของคนอื่น) => grader_order = 2
   *   - ถ้ามี >= 2 slot => error
   *   - ถ้า grader คนเดิมมี slot อยู่แล้วในข้อนี้ => error
   */
  static async createSlotFromQr(
    payload: CreateSlotFromQrPayload
  ): Promise<{
    slotId: number;
    graderOrder: number;
    status: string;
    bookletSubjectId: number;
    userId: number;
    userCode: string;
  }> {
    const { qrPayload, campaignId, sessionId, subjectId, questionNo, graderId } =
      payload;

    const connection = await DB.getInstance().getConnection();

    try {
      await connection.beginTransaction();

      // 1) ถอด QR -> ได้ { cid, sid, uid }
      // (ตัวอย่าง mock; ของจริงคุณเรียก keyService.decrypt แล้ว parse JSON)
      // const decrypted = await keyService.keyService.decrypt(qrPayload, ...);
      // const decoded = JSON.parse(decrypted) as { cid: number; sid: number; uid: string };

      const decoded = await keyService.decryptQrPayload(qrPayload, campaignId);
      console.log(decoded)

      if (decoded.cid !== campaignId || decoded.sid !== sessionId) {
        throw new Error("QR ไม่ตรงกับ campaign/session ที่กำลังตรวจ");
      }

      // 2) หา booklet_subject_id จาก cid + sid + subjectId + user_code(uid)
      const bookletRow = await gradingslotRepo.findBookletSubjectForUser(
        connection,
        campaignId,
        sessionId,
        subjectId,
        decoded.uid // user_code, ไม่ใช่ id
      );

      if (!bookletRow) {
        throw new Error("ไม่พบเล่มข้อสอบของผู้เข้าสอบรายนี้ในวิชานี้");
      }

      // 3) สร้าง slot ตาม rule (ใช้ helper ข้างล่าง)
      const slot = await gradingService.allocateSlotForQuestion(
        {
          bookletSubjectId: bookletRow.booklet_subject_id,
          questionNo,
          graderId,
        },
        connection
      );

      await connection.commit();

      return {
        slotId: slot.slotId,
        graderOrder: slot.graderOrder,
        status: slot.status,
        bookletSubjectId: bookletRow.booklet_subject_id,
        userId: bookletRow.user_id,
        userCode: bookletRow.user_code,
      };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  /**
   * core logic: 1 ข้อ = 2 slot, ห้ามคนเดิมซ้ำ
   * แยกออกมาเผื่ออยาก reuse ในกรณีที่ไม่ได้มาจาก QR
   */
  static async allocateSlotForQuestion(
    params: AllocateSlotParams,
    conn?: any
  ): Promise<{ slotId: number; graderOrder: number; status: string }> {
    const { bookletSubjectId, questionNo, graderId } = params;

    // ถ้าไม่ได้ส่ง connection มา ใช้ของตัวเอง (แต่จะไม่มี transaction ครอบ)
    const connection = conn || (await DB.getInstance().getConnection());

    let createdConnection = false;
    if (!conn) {
      createdConnection = true;
      await connection.beginTransaction();
    }

    try {
      // ดึง slot เดิมในข้อนี้ของกระดาษใบนี้มา (LOCK ด้วย FOR UPDATE)
      const existingSlots =
        await gradingslotRepo.findSlotsByBookletAndQuestion(
          connection,
          bookletSubjectId,
          questionNo,
          true
        );

      // ห้าม grader คนเดิมตรวจซ้ำในข้อนี้
      const alreadyHasThisGrader = existingSlots.some(
        (s) => s.grader_id === graderId
      );
      if (alreadyHasThisGrader) {
        throw new Error("ผู้ตรวจคนนี้ได้รับมอบหมายให้ตรวจข้อนี้อยู่แล้ว");
      }

      // ห้ามเกิน 2 slot ต่อ 1 ข้อ
      if (existingSlots.length >= 2) {
        throw new Error("ข้อนี้มีผู้ตรวจครบ 2 คนแล้ว");
      }

      // หา grader_order ว่าง (1 หรือ 2)
      const existingOrders = new Set(
        existingSlots.map((s) => Number(s.grader_order))
      );

      let graderOrder: number;
      if (!existingOrders.has(1)) {
        graderOrder = 1;
      } else if (!existingOrders.has(2)) {
        graderOrder = 2;
      } else {
        throw new Error("ไม่สามารถกำหนดลำดับผู้ตรวจได้ (slot เต็มแล้ว)");
      }

      // สร้าง slot ใหม่
      const newSlot = await gradingslotRepo.insertSlot(
        connection,
        bookletSubjectId,
        questionNo,
        graderOrder,
        graderId
      );

      if (createdConnection) {
        await connection.commit();
      }

      return {
        slotId: newSlot.id,
        graderOrder: newSlot.grader_order,
        status: newSlot.status,
      };
    } catch (err) {
      if (createdConnection) {
        await connection.rollback();
      }
      throw err;
    } finally {
      if (createdConnection) {
        connection.release();
      }
    }
  }
}
