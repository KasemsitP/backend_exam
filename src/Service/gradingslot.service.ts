// src/Service/gradingslot.service.ts
import { DB } from "../model/DB";
import gradingslotRepo from "../Repo/gradingslot.repo";
import bookletsRepo from "../Repo/booklets.repo"; // 👈 เพิ่ม import นี้เพื่อหาข้อมูลเล่มข้อสอบ
import { keyService } from "./key.service";
import { PoolConnection } from "mysql2/promise";
import gradingscoredraftRepo from "../Repo/gradingscoredraft.repo";

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

type PreviewStartResult = {
  canStart: boolean;
  bagId: number;
  bagNo: number;
  bookletId: number;
  random_num: string | number;
  examCode: string | number;
  subjectId: number;
  subjectName: string;
  questionNo: number;
  questionLabel?: string | null;
  graderId: number;
  totalBooklets: number;
  message: string;
  min_random?: number | null;
  max_random?: number | null;
};

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
    bagId: number;
    bagNo: number;
    random_num: number;
  }> {
    const { campaignId, graderId, questionNo } = payload;

    const connection = await DB.getInstance().getConnection();

    const qrPayload = keyService.unmaskQrPayload(payload.qrPayload)

    try {
      await connection.beginTransaction();

      const bookletRow = await bookletsRepo.findBookletsbyQRpayload(connection, qrPayload);

      if (!bookletRow) {
        throw new Error("ไม่พบเล่มข้อสอบนี้ในระบบ หรืออาจสแกนผิด");
      }
      if (bookletRow.bag_no === null || bookletRow.bag_id === null) {
        throw new Error("เล่มข้อสอบนี้ยังไม่ถูกจัดลงถุง ไม่สามารถสแกนได้");
      }
      const activeBag = await gradingscoredraftRepo.findActiveBagByGraderId(
        connection,
        graderId
      );

      if (activeBag && activeBag.bag_id !== Number(bookletRow.bag_id)) {
        throw new Error(
          `คุณกำลังตรวจถุงที่ ${activeBag.bag_no} อยู่ กรุณาตรวจถุงเดิมให้เสร็จก่อน`
        );
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

      const activeLock = await gradingslotRepo.findActiveLockByGraderId(
        connection,
        graderId
      );

      if (!activeLock) {
        await gradingslotRepo.createLock(connection, {
          graderId,
          campaignId,
          bagId: Number(bookletRow.bag_id),
          questionNo: Number(questionNo),
          createdBy: null,
        });
      } else {
        const sameBag = Number(activeLock.bag_id) === Number(bookletRow.bag_id);
        const sameQuestion = Number(activeLock.question_no) === Number(questionNo);

        if (!sameBag) {
          throw new Error(
            `คุณกำลังตรวจถุง ${activeLock.bag_id} อยู่ กรุณาตรวจถุงเดิมให้เสร็จก่อน`
          );
        }

        if (!sameQuestion) {
          throw new Error(
            `คุณกำลังตรวจข้อ ${activeLock.question_no} อยู่ กรุณาตรวจข้อนี้ให้เสร็จก่อน`
          );
        }
      }

      // 4) จอง slot ตามวิชากับข้อที่ assign ไว้
      const slot = await gradingService.allocateSlotForQuestion(
        {
          bookletId: bookletRow.id, // ใช้ id จาก booklets
          subjectId: question.subject_id,
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
        examCode: bookletRow.random_num, // ส่งเลขสุ่มกลับไป
        subjectId: question.subject_id,
        questionNo,
        bagId: bookletRow.bag_id,
        bagNo: bookletRow.bag_no,
        random_num: bookletRow.random_num
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
      const unscoredSlot = await gradingscoredraftRepo.findUnscoredSlotForGrader(
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
  static async previewStartFromQr(
    payload: CreateSlotFromQrPayload
  ): Promise<PreviewStartResult> {
    const { campaignId, graderId, questionNo } = payload;
    const connection = await DB.getInstance().getConnection();

    try {
      const qrPayload = keyService.unmaskQrPayload(payload.qrPayload);

      const bookletRow = await bookletsRepo.findBookletsbyQRpayload(
        connection,
        qrPayload
      );

      if (!bookletRow) {
        throw new Error("ไม่พบเล่มข้อสอบนี้ในระบบ หรืออาจสแกนผิด");
      }

      if (bookletRow.bag_no === null || bookletRow.bag_id === null) {
        throw new Error("เล่มข้อสอบนี้ยังไม่ถูกจัดลงถุง ไม่สามารถสแกนได้");
      }

      const sid = bookletRow.session_id;

      const assignment = await gradingslotRepo.findAssignmentForGraderInSession(
        connection,
        graderId,
        sid
      );

      if (!assignment || assignment.length === 0) {
        throw new Error("ผู้ตรวจคนนี้ไม่ได้ถูกมอบหมายให้ตรวจข้อสอบในรอบนี้");
      }

      const qNo = Number(questionNo);
      const question = assignment.find((a) => a.question_no === qNo);

      if (!question) {
        throw new Error("ข้อที่เลือกไม่ได้ถูกมอบหมายให้คุณตรวจ");
      }

      const activeLockByBagQuestion =
        await gradingslotRepo.findActiveLockByBagAndQuestion(
          connection,
          Number(bookletRow.bag_id),
          Number(question.question_no)
        );

      if (
        activeLockByBagQuestion &&
        Number(activeLockByBagQuestion.grader_id) !== Number(graderId)
      ) {
        throw new Error(
          "มีผู้ตรวจคนอื่นกำลังตรวจข้อสอบถุงนี้อยู่ กรุณาติดต่อเจ้าหน้าที่"
        );
      }

      // เช็ค lock งานปัจจุบัน
      const activeLock = await gradingslotRepo.findActiveLockByGraderId(
        connection,
        graderId
      );

      if (activeLock) {
        const sameBag = Number(activeLock.bag_id) === Number(bookletRow.bag_id);
        const sameQuestion =
          Number(activeLock.question_no) === Number(question.question_no);

        if (!sameBag) {
          throw new Error(
            `คุณกำลังตรวจถุงที่ ${activeLock.bag_id} อยู่ กรุณาตรวจถุงเดิมให้เสร็จก่อน`
          );
        }

        if (!sameQuestion) {
          throw new Error(
            `คุณกำลังตรวจข้อ ${activeLock.question_no} อยู่ กรุณาตรวจข้อนี้ให้เสร็จก่อน`
          );
        }
      }

      const totalBooklets = await bookletsRepo.countByBagId(
        connection,
        Number(bookletRow.bag_id)
      );

      const randomNums = await bookletsRepo.findRandomNumsByBagId(
  connection,
  Number(bookletRow.bag_id)
);

const min_random =
  randomNums.length > 0 ? Math.min(...randomNums) : null;

const max_random =
  randomNums.length > 0 ? Math.max(...randomNums) : null;

      return {
        canStart: true,
        bagId: Number(bookletRow.bag_id),
        bagNo: Number(bookletRow.bag_no),
        bookletId: Number(bookletRow.id),
        random_num: bookletRow.random_num,
        examCode: bookletRow.random_num,
        subjectId: Number(question.subject_id),
        subjectName: question.subject_name ?? "-",
        questionNo: Number(question.question_no),
        questionLabel: question.question_label ?? null,
        graderId,
        totalBooklets: Number(totalBooklets ?? 0),
        min_random,
        max_random,
        message: "พร้อมเริ่มตรวจถุงนี้",
      };
    } finally {
      connection.release();
    }
  }

  static async confirmStartFromQr(
    payload: CreateSlotFromQrPayload
  ): Promise<{
    slotId: number;
    graderOrder: number;
    status: string;
    bookletId: number;
    examCode: string | number;
    subjectId: number;
    questionNo: number;
    bagId: number;
    bagNo: number;
    random_num: string | number;
  }> {
    const { campaignId, graderId, questionNo } = payload;
    const connection = await DB.getInstance().getConnection();

    try {
      await connection.beginTransaction();

      const qrPayload = keyService.unmaskQrPayload(payload.qrPayload);

      const bookletRow = await bookletsRepo.findBookletsbyQRpayload(
        connection,
        qrPayload
      );

      if (!bookletRow) {
        throw new Error("ไม่พบเล่มข้อสอบนี้ในระบบ หรืออาจสแกนผิด");
      }

      if (bookletRow.bag_no === null || bookletRow.bag_id === null) {
        throw new Error("เล่มข้อสอบนี้ยังไม่ถูกจัดลงถุง ไม่สามารถสแกนได้");
      }

      const sid = bookletRow.session_id;

      const assignment = await gradingslotRepo.findAssignmentForGraderInSession(
        connection,
        graderId,
        sid
      );

      if (!assignment || assignment.length === 0) {
        throw new Error("ผู้ตรวจคนนี้ไม่ได้ถูกมอบหมายให้ตรวจข้อสอบในรอบนี้");
      }

      const qNo = Number(questionNo);
      const question = assignment.find((a) => a.question_no === qNo);

      if (!question) {
        throw new Error("ข้อที่เลือกไม่ได้ถูกมอบหมายให้คุณตรวจ");
      }

      // เช็ค / สร้าง lock
      const activeLock = await gradingslotRepo.findActiveLockByGraderId(
        connection,
        graderId
      );

      if (!activeLock) {
        await gradingslotRepo.createLock(connection, {
          graderId,
          campaignId,
          bagId: Number(bookletRow.bag_id),
          questionNo: Number(question.question_no),
        });
      } else {
        const sameBag = Number(activeLock.bag_id) === Number(bookletRow.bag_id);
        const sameQuestion =
          Number(activeLock.question_no) === Number(question.question_no);

        if (!sameBag) {
          throw new Error(
            `คุณกำลังตรวจถุงที่ ${activeLock.bag_id} อยู่ กรุณาตรวจถุงเดิมให้เสร็จก่อน`
          );
        }

        if (!sameQuestion) {
          throw new Error(
            `คุณกำลังตรวจข้อ ${activeLock.question_no} อยู่ กรุณาตรวจข้อนี้ให้เสร็จก่อน`
          );
        }
      }

      const slot = await gradingService.allocateSlotForQuestion(
        {
          bookletId: Number(bookletRow.id),
          subjectId: Number(question.subject_id),
          questionNo: Number(question.question_no),
          graderId,
        },
        connection
      );

      await connection.commit();

      return {
        slotId: slot.slotId,
        graderOrder: slot.graderOrder,
        status: slot.status,
        bookletId: Number(bookletRow.id),
        examCode: bookletRow.random_num,
        subjectId: Number(question.subject_id),
        questionNo: Number(question.question_no),
        bagId: Number(bookletRow.bag_id),
        bagNo: Number(bookletRow.bag_no),
        random_num: bookletRow.random_num,
      };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

}