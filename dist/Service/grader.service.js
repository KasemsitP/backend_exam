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
exports.graderService = void 0;
// src/Service/grader.service.ts
const DB_1 = require("../model/DB");
const grader_repo_1 = __importDefault(require("../Repo/grader.repo"));
class graderService {
}
exports.graderService = graderService;
_a = graderService;
graderService.getAllByCampaignId = (campaignIdNumeric) => __awaiter(void 0, void 0, void 0, function* () {
    const connection = yield DB_1.DB.getInstance().getConnection();
    try {
        const rows = yield grader_repo_1.default.findAllAssignmentsByCampaignId(campaignIdNumeric, connection);
        const assignments = rows.map((r) => ({
            grader_id: r.grader_id,
            account_id: r.account_id,
            campaign_id: r.campaign_id,
            session_id: r.session_id,
            session_code: r.session_code,
            exam_date: r.exam_date,
            grader_name: r.grader_name,
            subject_id: r.subject_id,
            subject_code: r.subject_code,
            subject_name: r.subject_name,
            subject_question_id: r.subject_question_id,
            question_no: r.question_no,
            question_label: r.question_label,
            max_score: r.max_score
        }));
        return assignments;
    }
    catch (error) {
        console.error("Service Error (graderService.getAllByCampaignId):", error);
        throw error;
    }
    finally {
        connection.release();
    }
});
graderService.getAssignmentByAccountId = (campaign_id, account_id) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield grader_repo_1.default.getAssignmentByAccountId(campaign_id, account_id);
    return result;
});
graderService.getBagFinished = (campaign_id, grader_id) => __awaiter(void 0, void 0, void 0, function* () {
    const conn = yield DB_1.DB.getInstance().getConnection();
    try {
        const result = yield grader_repo_1.default.findConfirmedBagsByCampaignAndGrader(conn, campaign_id, grader_id);
        return result;
    }
    finally {
        conn.release();
    }
});
graderService.create = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    var _b;
    const connection = yield DB_1.DB.getInstance().getConnection();
    try {
        yield connection.beginTransaction();
        const result = yield grader_repo_1.default.create({
            campaign_id: payload.campaignId,
            account_id: (_b = payload.accountId) !== null && _b !== void 0 ? _b : null, // << สำคัญ
        }, connection);
        yield connection.commit();
        return result;
    }
    catch (error) {
        yield connection.rollback();
        console.error("Service Error (graderService.create):", error);
        throw error;
    }
    finally {
        connection.release();
    }
});
graderService.updateById = (id, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const connection = yield DB_1.DB.getInstance().getConnection();
    try {
        yield connection.beginTransaction();
        const result = yield grader_repo_1.default.updateById(id, {
            name: payload.name,
            account_id: payload.accountId,
        }, connection);
        yield connection.commit();
        return result;
    }
    catch (error) {
        yield connection.rollback();
        console.error("Service Error (graderService.updateById):", error);
        throw error;
    }
    finally {
        connection.release();
    }
});
graderService.deleteById = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const connection = yield DB_1.DB.getInstance().getConnection();
    try {
        yield connection.beginTransaction();
        const result = yield grader_repo_1.default.deleteById(id, connection);
        yield connection.commit();
        return result;
    }
    catch (error) {
        yield connection.rollback();
        console.error("Service Error (graderService.deleteById):", error);
        throw error;
    }
    finally {
        connection.release();
    }
});
