// src/Service/gradingslot.service.ts
import { DB } from "../model/DB";
import gradingslotRepo from "../Repo/gradingslot.repo";
import bookletsRepo from "../Repo/booklets.repo"; // 👈 เพิ่ม import นี้เพื่อหาข้อมูลเล่มข้อสอบ
import { keyService } from "./key.service";
import { PoolConnection } from "mysql2/promise";

interface CreateSlotFromQrPayload {
  qrPayload: string;
  campaignId: number;
  graderId: number;
  questionNo: number;
}

interface AllocateSlotParams {
  bookletId: number;
  subjectId: number;
  questionNo: number;
  graderId: number;
}

export class gradingService {
  static async createSlotFromQr(
    payload: CreateSlotFromQrPayload
  ): Promise<{
    slotId: number;
    graderOrder: number;
    status: string;
    bookletId: number;
    examCode: string; 
    subjectId: number;
    questionNo: number;
    bagId : number;
    bagNo : number;
  }> {
    const { qrPayload, campaignId, graderId, questionNo } = payload;

    const connection = await DB.getInstance().getConnection();

    try {
      await connection.beginTransaction();

      const bookletRow = await bookletsRepo.findBookletsbyQRpayload(connection, qrPayload);

      if (!bookletRow) {
        throw new Error("ไม่พบเล่มข้อสอบนี้ในระบบ หรืออาจสแกนผิด");
      }
      if(bookletRow.bag_no === null || bookletRow.bag_id === null){
        throw new Error("เล่มข้อสอบนี้ยังไม่ถูกจัดลงถุง ไม่สามารถสแกนได้");
       }

      // 2)  ได้ session_id มาจากตัวกระดาษคำตอบเลย
      const sid = bookletRow.session_id;

      // 3) ดูว่า grader คนนี้ใน session นี้ ถูก assign ข้ออะไร
      const assignment =
        await gradingslotRepo.findAssignmentForGraderInSession(
          connection,
          graderId,
          sid
        );
      
      if (!assignment || assignment.length === 0) {
        throw new Error(
          "ผู้ตรวจคนนี้ไม่ได้ถูกมอบหมายให้ตรวจข้อสอบในรอบนี้"
        );
      }

      const qNo = Number(questionNo);
      const question = assignment.find(
        a => a.question_no === qNo
      );

      if (!question) {
        throw new Error("ข้อที่เลือกไม่ได้ถูกมอบหมายให้คุณตรวจ");
      }

      // 4) จอง slot ตามวิชากับข้อที่ assign ไว้
      const slot = await gradingService.allocateSlotForQuestion(
        {
          bookletId: bookletRow.id, // ใช้ id จาก booklets
          subjectId :  question.subject_id,
          questionNo: question.question_no,
          graderId,
        },
        connection
      );

      await connection.commit();

      return {
        slotId: slot.slotId,
        graderOrder: slot.graderOrder,
        status: slot.status,
        bookletId: bookletRow.id,
        examCode: bookletRow.random_num , // ส่งเลขสุ่มกลับไป
        subjectId : question.subject_id,
        questionNo,
        bagId : bookletRow.bag_id ,
        bagNo : bookletRow.bag_no ,
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
      console.log(bookletId, subjectId, questionNo, graderId);
      const unscoredSlot = await gradingslotRepo.findUnscoredSlotForGrader(
        connection,
        bookletId,
        subjectId,
        questionNo,
        graderId
      );
      console.log("Unscored Slot Check:", unscoredSlot);

      if (unscoredSlot) {
        // เคส: สแกนซ้ำ / หน้าเด้ง แต่ยังไม่เคยบันทึก score
        if (createdConnection) {
          await connection.commit();
        }
        return {
          slotId: unscoredSlot.id,
          graderOrder: unscoredSlot.grader_order ?? 1,
          status: unscoredSlot.status,
        };
      }
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
      console.log("Existing Slots for this Question:", existingSlots);
      if (alreadyHasThisGrader) {
        throw new Error("คุณเคยตรวจข้อสอบเล่มนี้แล้ว! ไม่สามารถตรวจซ้ำได้");
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