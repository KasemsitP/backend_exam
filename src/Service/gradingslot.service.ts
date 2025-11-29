// src/Service/gradingslot.service.ts
import { DB } from "../model/DB";
import gradingslotRepo from "../Repo/gradingslot.repo";
import { keyService } from "./key.service";
import { PoolConnection } from "mysql2/promise";

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
  bookletId: number;
  subjectId: number;
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
    bookletId: number;
    userId: number;
    userCode: string;
  }> {
    const { qrPayload, campaignId, sessionId, subjectId, questionNo, graderId } =
      payload;

    const connection = await DB.getInstance().getConnection();

    try {
      await connection.beginTransaction();

      const decoded = await keyService.decryptQrPayload(qrPayload, campaignId);
      console.log(decoded);

      if (decoded.cid !== campaignId || decoded.sid !== sessionId) {
        throw new Error("QR ไม่ตรงกับ campaign/session ที่กำลังตรวจ");
      }

      // 🔁 ใช้ findBookletForUser แทน findBookletSubjectForUser
      const bookletRow = await gradingslotRepo.findBookletForUser(
        connection,
        campaignId,
        sessionId,
        decoded.uid // user_code
      );

      if (!bookletRow) {
        throw new Error("ไม่พบเล่มข้อสอบของผู้เข้าสอบรายนี้ใน session นี้");
      }

      const slot = await gradingService.allocateSlotForQuestion(
        {
          bookletId: bookletRow.booklet_id,
          subjectId,
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
        bookletId: bookletRow.booklet_id,
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
    conn?: PoolConnection
  ): Promise<{ slotId: number; graderOrder: number; status: string }> {
    const { bookletId, subjectId, questionNo, graderId } = params;

    const connection = conn || (await DB.getInstance().getConnection());

    let createdConnection = false;
    if (!conn) {
      createdConnection = true;
      await connection.beginTransaction();
    }

    try {
      // ดึง slot เดิมของเล่มนี้ + วิชานี้ + ข้อนี้ (LOCK)
      const existingSlots =
        await gradingslotRepo.findSlotsByBookletAndQuestion(
          connection,
          bookletId,
          subjectId,
          questionNo,
          true
        );

      const alreadyHasThisGrader = existingSlots.some(
        (s) => s.grader_id === graderId
      );
      if (alreadyHasThisGrader) {
        throw new Error("ผู้ตรวจคนนี้ได้รับมอบหมายให้ตรวจข้อนี้อยู่แล้ว");
      }

      if (existingSlots.length >= 2) {
        throw new Error("ข้อนี้มีผู้ตรวจครบ 2 คนแล้ว");
      }

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

      const newSlot = await gradingslotRepo.insertSlot(
        connection,
        bookletId,
        subjectId,
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
