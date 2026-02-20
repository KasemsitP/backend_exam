"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingService = void 0;
const DB_1 = require("../model/DB");
const settings_repo_1 = __importDefault(require("../Repo/settings.repo"));
const exam_repo_1 = __importDefault(require("../Repo/exam.repo"));
class SettingService {
    static ActiveInActiveQR(campaign_id) {
        return __awaiter(this, void 0, void 0, function* () {
            const conn = yield DB_1.DB.getInstance().getConnection();
            try {
                yield conn.beginTransaction();
                //   const examLists = await examDataRepo.CampaignLists(conn);
                const qr_active = yield exam_repo_1.default.CheckQRactive(conn, campaign_id);
                if (qr_active === true) {
                    yield exam_repo_1.default.UpdateQRNoActive(conn, campaign_id);
                }
                else {
                    yield exam_repo_1.default.UpdateQRActive(conn, campaign_id);
                }
                yield conn.commit();
            }
            catch (error) {
                yield conn.rollback();
                console.error("ไม่สามารถเปิด-ปิดรอบสอบได้", error);
                throw error;
            }
            finally {
                conn.release();
            }
        });
    }
    static getSettingStatus(campaign_id) {
        return __awaiter(this, void 0, void 0, function* () {
            const conn = yield DB_1.DB.getInstance().getConnection();
            try {
                yield conn.beginTransaction();
                const campStatus = yield settings_repo_1.default.CampStatus(campaign_id, conn);
                const keysStatus = yield settings_repo_1.default.QRStatus(campaign_id, conn);
                yield conn.commit();
                return {
                    campStatus: campStatus,
                    QRStatus: keysStatus
                };
            }
            catch (error) {
                yield conn.rollback();
                console.error("ไม่สามารถเปิดใช้รอบสอบได้", error);
                throw error;
            }
            finally {
                conn.release();
            }
        });
    }
}
exports.SettingService = SettingService;
_a = SettingService;
SettingService.ActiveInActiveCampaign = (campaign_id) => __awaiter(void 0, void 0, void 0, function* () {
    const conn = yield DB_1.DB.getInstance().getConnection();
    try {
        yield conn.beginTransaction();
        const examLists = yield exam_repo_1.default.CampaignLists(conn);
        const is_active = yield exam_repo_1.default.Checkactive(conn, campaign_id);
        const current_active = examLists.find((row) => row.is_active === 1);
        if (is_active === 0) {
            if (current_active && current_active.id !== campaign_id) {
                throw new Error("มีรอบสอบที่เปิดใช้งานอยู่แล้ว กรุณาปิดรอบสอบเดิมก่อน");
            }
            yield exam_repo_1.default.UpdateExamActive(conn, campaign_id);
        }
        else {
            yield exam_repo_1.default.UpdateExamNoActive(conn, campaign_id);
        }
        yield conn.commit();
    }
    catch (error) {
        yield conn.rollback();
        console.error("ไม่สามารถเปิด-ปิดรอบสอบได้", error);
        throw error;
    }
    finally {
        conn.release();
    }
});
