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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionSubjectController = void 0;
const session_subject_service_1 = require("../Service/session-subject.service");
class sessionSubjectController {
}
exports.sessionSubjectController = sessionSubjectController;
_a = sessionSubjectController;
sessionSubjectController.create = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const payload = req.body;
        payload.session_id = parseInt(payload.session_id, 10);
        if (isNaN(payload.session_id)) {
            return res.status(400).send({ message: "Invalid session_id" });
        }
        if (!payload.code || !payload.name) {
            return res
                .status(400)
                .send({ message: "Missing subject code or name" });
        }
        // 3. ส่งให้ Service จัดการ (Find/Create + Link)
        const data = yield session_subject_service_1.sessionSubjectService.create(payload);
        // 4. ส่งผลลัพธ์ (ที่ Join แล้ว) กลับไป
        res.status(201).json(data);
    }
    catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            return res
                .status(409)
                .send({ message: "วิชานี้ถูกเพิ่มในรอบสอบนี้แล้ว" });
        }
        res.status(500).send({ message: error.message });
    }
});
sessionSubjectController.delete = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const sessionId = parseInt(req.params.sessionId, 10);
        const subjectId = parseInt(req.params.subjectId, 10);
        if (isNaN(sessionId) || isNaN(subjectId)) {
            return res
                .status(400)
                .send({ message: "Invalid Session or Subject ID" });
        }
        yield session_subject_service_1.sessionSubjectService.delete(sessionId, subjectId);
        res.status(204).send(); // 204 No Content
    }
    catch (error) {
        res.status(500).send({ message: error.message });
    }
});
