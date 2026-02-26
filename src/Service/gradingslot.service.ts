// src/Service/gradingslot.service.ts
import { DB } from "../model/DB";
import gradingslotRepo from "../Repo/gradingslot.repo";
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
    userId: number;
    userCode: string;
    subjectId: number;
    questionNo: number;
    bagId : number;
    bagNo : number;
  }> {
    const { qrPayload, campaignId, graderId, questionNo } = payload;

    const connection = await DB.getInstance().getConnection();

    try {
      await connection.beginTransaction();

      // 1) ถอด QR
      const decoded = await keyService.decryptQrPayloadNoLocks(qrPayload, campaignId);
      // decoded: { cid, sid, uid, ... }
      const { cid, sid, uid } = decoded;
      console.log(decoded)

      if (cid !== campaignId) {
        throw new Error("QR ไม่ตรงกับแคมเปญที่กำลังตรวจ");
      }

      // 2) ดูว่า grader คนนี้ใน session นี้ ถูก assign ข้ออะไร
      const assignment =
        await gradingslotRepo.findAssignmentForGraderInSession(
          connection,
          graderId,
          sid
        );
      const questions = assignment.map(a => ({
        subjectId: a.subject_id,
        questionId: a.subject_question_id,
        questionNo: a.question_no,
        label: a.question_label
      }));

      console.log(assignment)
      if (!assignment) {
        throw new Error(
          "ผู้ตรวจคนนี้ไม่ได้ถูกมอบหมายให้ตรวจในรอบสอบนี้ (หรือยังไม่ได้เซ็ต assignment)"
        );
      }

      // const subjectId = assignment.subject_id;
      // const questionNo = assignment.question_no;
      // const subjectQuestionId = assignment.subject_question_id;
      const qNo = Number(questionNo);

      const question = assignment.find(
        a => a.question_no === qNo
      );

     

      if (!question) {
        throw new Error("ข้อที่เลือกไม่ได้ถูกมอบหมายให้คุณ");
      }
       console.log("question", question)
      // 3) หาเล่มของผู้เข้าสอบ (จาก user_code / uid ใน QR)
      const bookletRow = await gradingslotRepo.findBookletForUser(
        connection,
        campaignId,
        sid,
        uid // user_code
      );

      if (!bookletRow) {
        throw new Error("ไม่พบเล่มข้อสอบของผู้เข้าสอบรายนี้ใน session นี้");
      }

      // 4) จอง slot ตามวิชากับข้อที่ assign ไว้
      const slot = await gradingService.allocateSlotForQuestion(
        {
          bookletId: bookletRow.booklet_id,
          subjectId :  question.subject_id,
          questionNo: question.question_no,
          // หรือใช้ subjectQuestionId ถ้า grading_slots เก็บอ้างถึง subject_questions โดยตรง
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
        subjectId : question.subject_id,
        questionNo,
        bagId : bookletRow.bag_id,
        bagNo : bookletRow.bag_no
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
      const unscoredSlot = await gradingslotRepo.findUnscoredSlotForGrader(
        connection,
        bookletId,
        subjectId,
        questionNo,
        graderId
      );

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
      console.log(alreadyHasThisGrader, existingSlots)
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
