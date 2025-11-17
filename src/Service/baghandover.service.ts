// src/Service/baghandover.service.ts
import { DB } from "../model/DB";
import bagLogRepo, { BagLogDbRow } from "../Repo/baghandover.repo";

export type BagActionType = "CHECK_OUT" | "CHECK_IN";

export interface BagLockDTO {
  id: string;
  campaignId: string; // camp-1
  bagId: number;      // ใช้ bag_no
  graderId: number;
  graderName: string;
  operatorId: number;
  operatorName: string;
  at: string;         // ISO string
}

export interface BagLogDTO {
  id: string;
  campaignId: string; // camp-1
  bagId: number;      // bag_no
  action: BagActionType;
  graderId?: number | null;
  operatorId?: number | null;
  timestamp: string;
  note?: string | null;
}

interface CheckInPayload {
  campaignId: string;   // "camp-1"
  sessionId: number;    // sessions.id
  bagNo: number;        // bags.bag_no
  graderId: number;     // graders.id
  operatorId: number;   // accounts.id
  note?: string;
}

interface CheckOutPayload {
  campaignId: string;   // "camp-1"
  sessionId: number;
  bagNo: number;
  operatorId: number;
  note?: string;
}

const parseCampaignId = (id: string): number => {
  // รองรับทั้ง "camp-1" หรือ "1"
  if (id.startsWith("camp-")) {
    return parseInt(id.replace("camp-", ""), 10);
  }
  return parseInt(id, 10);
};

const toCampaignString = (id: number): string => `camp-${id}`;

const mapDbRowToLogDto = (row: BagLogDbRow): BagLogDTO => {
  const campaignIdStr = toCampaignString(row.campaign_id);

  // mapping action DB → frontend
  // ISSUE/TRANSFER = "ถุงกำลังถูกถือ" → CHECK_OUT
  // RETURN         = "ถุงคืนแล้ว"      → CHECK_IN
  const action: BagActionType =
    row.action === "RETURN" ? "CHECK_IN" : "CHECK_OUT";

  const ts =
    row.at_time instanceof Date
      ? row.at_time.toISOString()
      : new Date(row.at_time).toISOString();

  return {
    id: String(row.id),
    campaignId: campaignIdStr,
    bagId: row.bag_no,
    action,
    graderId: row.grader_id,
    operatorId: row.operator_id,
    timestamp: ts,
    note: row.note,
  };
};

/**
 * สร้าง locks จาก log ทั้งหมด:
 * - group ตาม (session_id, bag_no)
 * - เอาแถวสุดท้ายของแต่ละถุง
 * - ถ้า action สุดท้ายเป็น ISSUE/TRANSFER → ถือว่าถุงกำลังถูกตรวจ (locked)
 * - ถ้า RETURN → ถุงว่าง (ไม่ lock)
 */
const deriveLocksFromLogs = (rows: BagLogDbRow[]): BagLockDTO[] => {
  const lastByBagKey = new Map<string, BagLogDbRow>();

  for (const row of rows) {
    const key = `${row.session_id}-${row.bag_no}`;
    // rows มาตามเวลา ASC อยู่แล้ว แค่ override ก็ได้ last
    lastByBagKey.set(key, row);
  }

  const locks: BagLockDTO[] = [];

  for (const row of lastByBagKey.values()) {
    if (row.action === "RETURN") {
      continue; // คืนแล้ว ไม่ lock
    }

    const campaignIdStr = toCampaignString(row.campaign_id);
    const ts =
      row.at_time instanceof Date
        ? row.at_time.toISOString()
        : new Date(row.at_time).toISOString();

    locks.push({
      id: `lock-${campaignIdStr}-${row.session_id}-${row.bag_no}`,
      campaignId: campaignIdStr,
      bagId: row.bag_no,
      graderId: row.grader_id ?? 0,
      graderName: row.grader_name ?? `Grader#${row.grader_id ?? "?"}`,
      operatorId: row.operator_id ?? 0,
      operatorName: row.operator_name ?? `Operator#${row.operator_id ?? "?"}`,
      at: ts,
    });
  }

  return locks;
};

export class BagHandoverService {
  /**
   * GET ทั้ง locks + logs สำหรับ 1 campaign
   */
  static async getForCampaign(campaignId: string): Promise<{
    locks: BagLockDTO[];
    logs: BagLogDTO[];
  }> {
    const connection = await DB.getInstance().getConnection();
    try {
      const campaignIdNumeric = parseCampaignId(campaignId);

      const rows = await bagLogRepo.findByCampaignId(
        campaignIdNumeric,
        connection
      );

      const locks = deriveLocksFromLogs(rows);
      const logs = rows.map(mapDbRowToLogDto).reverse(); // ให้ log ใหม่อยู่บนสุด

      return { locks, logs };
    } finally {
      connection.release();
    }
  }

  /**
   * Check-in = ลงทะเบียนถุงให้ผู้ตรวจ (action = ISSUE)
   */
  static async checkIn(payload: CheckInPayload) {
    const connection = await DB.getInstance().getConnection();
    try {
      await connection.beginTransaction();

      const { sessionId, bagNo, graderId, operatorId, note } = payload;

      // optional: ตรวจว่าถุงนี้มีจริงไหม
      const exists = await bagLogRepo.ensureBagExists(
        sessionId,
        bagNo,
        connection
      );
      if (!exists) {
        throw new Error(
          `ไม่พบถุงใน session_id=${sessionId}, bag_no=${bagNo}`
        );
      }

      await bagLogRepo.insertIssueLog(
        {
          session_id: sessionId,
          bag_no: bagNo,
          grader_id: graderId,
          operator_id: operatorId,
          note: note ?? null,
        },
        connection
      );

      await bagLogRepo.updateBagStatus(
        sessionId,
        bagNo,
        "ISSUED",
        connection
      );

      await connection.commit();

      return { success: true };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  /**
   * Check-out = รับคืนถุง (action = RETURN)
   */
  static async checkOut(payload: CheckOutPayload) {
    const connection = await DB.getInstance().getConnection();
    try {
      await connection.beginTransaction();

      const { sessionId, bagNo, operatorId, note } = payload;

      const exists = await bagLogRepo.ensureBagExists(
        sessionId,
        bagNo,
        connection
      );
      if (!exists) {
        throw new Error(
          `ไม่พบถุงใน session_id=${sessionId}, bag_no=${bagNo}`
        );
      }

      await bagLogRepo.insertReturnLog(
        {
          session_id: sessionId,
          bag_no: bagNo,
          operator_id: operatorId,
          note: note ?? null,
        },
        connection
      );

      await bagLogRepo.updateBagStatus(
        sessionId,
        bagNo,
        "RETURNED",
        connection
      );

      await connection.commit();

      return { success: true };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }
}
