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
Object.defineProperty(exports, "__esModule", { value: true });
// src/Repo/grader-assignment.repo.ts
const DB_1 = require("../model/DB");
class GraderAssignmentRepo {
    constructor() {
        this.pool = DB_1.DB.getInstance();
    }
    insertOne(payload_1) {
        return __awaiter(this, arguments, void 0, function* (payload, dbClient = this.pool) {
            console.log("assign Repo", payload);
            const sql = `
      INSERT INTO grader_assignments
        (grader_id, session_id, subject_id, subject_question_id)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        grader_id = grader_id
    `;
            const params = [
                payload.grader_id,
                payload.session_id,
                payload.subject_id,
                payload.subject_question_id,
            ];
            yield dbClient.execute(sql, params);
        });
    }
}
const graderAssignmentRepo = new GraderAssignmentRepo();
exports.default = graderAssignmentRepo;
