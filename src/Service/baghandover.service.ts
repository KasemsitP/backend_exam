// src/Service/baghandover.service.ts
import { DB } from "../model/DB";
import bagLogRepo, { BagLogDbRow } from "../Repo/baghandover.repo";
import bagRepo from "../Repo/bag.repo";          // 👈 เพิ่ม import นี้ (ใช้หา session_id จาก bag)

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

// ✅ ตัด sessionId ออกจาก payload ฝั่ง service
interface CheckInPayload {
  campaignId: string;   // "camp-1"
  bagId: number;          // bags.bag_no
  graderId: number;     // graders.id
  operatorId: number;   // accounts.id
  note?: string;
}

interface CheckOutPayload {
  campaignId: string;   // "camp-1"
  bagId: number;        // 👈 ใช้ PK ของ bags
  operatorId: number;
  note?: string;
}

const parseCampaignId = (id: string): number => {
  if (id.startsWith("camp-")) {
    return parseInt(id.replace("camp-", ""), 10);
  }
  return parseInt(id, 10);
};

const toCampaignString = (id: number): string => `camp-${id}`;

const mapDbRowToLogDto = (row: BagLogDbRow): BagLogDTO => {
  const campaignIdStr = toCampaignString(row.campaign_id);

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

const deriveLocksFromLogs = (rows: BagLogDbRow[]): BagLockDTO[] => {
  const lastByBagKey = new Map<string, BagLogDbRow>();

  for (const row of rows) {
    const key = `${row.session_id}-${row.bag_no}`;
    lastByBagKey.set(key, row);
  }

  const locks: BagLockDTO[] = [];

  for (const row of lastByBagKey.values()) {
    if (row.action === "RETURN") continue;

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
  static async getForCampaign(
    campaignId: string
  ): Promise<{
    locks: BagLockDTO[];
    logs: BagLogDTO[];
  }> {
    const connection = await DB.getInstance().getConnection();

    try {
      // แปลง campaignId จาก string เป็น number
      const campaignIdNumeric = parseCampaignId(campaignId);

      // ดึง log ทั้งหมดของ campaign
      const rows = await bagLogRepo.findByCampaignId(
        campaignIdNumeric,
        connection
      );

      const locks = deriveLocksFromLogs(rows);

      const logs = rows
        .map(mapDbRowToLogDto)
        .reverse();

      return { locks, logs };
    } finally {
      // ปิด connection ไม่ว่าจะ success หรือ error
      connection.release();
    }
  }


  static async checkIn(payload: CheckInPayload) {
    const connection = await DB.getInstance().getConnection();
    try {
      await connection.beginTransaction();

      const { campaignId, bagId, graderId, operatorId, note } = payload;
      const campaignIdNumeric = parseCampaignId(campaignId);

      // 1) หา bag จาก PK
      const bagRow = await bagRepo.findById(connection, bagId);   // 👈 เดี๋ยวดูต่อด้านล่าง
      if (!bagRow) {
        throw new Error(`ไม่พบถุง id=${bagId}`);
      }
      if (Number(bagRow.campaign_id) !== campaignIdNumeric) {
        throw new Error(
          `ถุงไม่ได้อยู่ในแคมเปญนี้ (campaign_id=${bagRow.campaign_id}, current=${campaignIdNumeric})`
        );
      }

      const sessionId = Number(bagRow.session_id);
      const bagNo = Number(bagRow.bag_no);   // 👈 อันนี้แหละที่ FK ต้องการ

      // 2) insert ISSUE log
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

      // 3) update bag status
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
      console.error("Service Error (BagHandoverService.checkIn):", err);
      throw err;
    } finally {
      connection.release();
    }
  }

  static async checkOut(payload: CheckOutPayload) {
    const connection = await DB.getInstance().getConnection();
    try {
      await connection.beginTransaction();

      const { campaignId, bagId, operatorId, note } = payload;
      const campaignIdNumeric = parseCampaignId(campaignId);

      const bagRow = await bagRepo.findById(connection, bagId);
      if (!bagRow) {
        throw new Error(`ไม่พบถุง id=${bagId}`);
      }
      if (Number(bagRow.campaign_id) !== campaignIdNumeric) {
        throw new Error(
          `ถุงไม่ได้อยู่ในแคมเปญนี้ (campaign_id=${bagRow.campaign_id}, current=${campaignIdNumeric})`
        );
      }

      const sessionId = Number(bagRow.session_id);
      const bagNo = Number(bagRow.bag_no);

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
      console.error("Service Error (BagHandoverService.checkOut):", err);
      throw err;
    } finally {
      connection.release();
    }
  }
}
