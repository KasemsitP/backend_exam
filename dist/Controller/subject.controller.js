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
exports.SubjectController = void 0;
const subject_service_1 = require("../Service/subject.service");
class SubjectController {
    static getAll(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const subjects = yield subject_service_1.SubjectService.getAllSubjects(req);
                res.json(subjects);
            }
            catch (err) {
                console.error("Error getAll subjects:", err);
                res.status(500).json({ message: "Failed to fetch subjects" });
            }
        });
    }
    static create(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const subject = yield subject_service_1.SubjectService.createSubject(req);
                res.status(201).json(subject);
            }
            catch (err) {
                console.error("Error create subject:", err);
                res
                    .status(400)
                    .json({ message: (err === null || err === void 0 ? void 0 : err.message) || "Failed to create subject" });
            }
        });
    }
    static update(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const subject = yield subject_service_1.SubjectService.updateSubject(req);
                if (!subject) {
                    return res.status(404).json({ message: "Subject not found" });
                }
                res.json(subject);
            }
            catch (err) {
                console.error("Error update subject:", err);
                res
                    .status(400)
                    .json({ message: (err === null || err === void 0 ? void 0 : err.message) || "Failed to update subject" });
            }
        });
    }
    static remove(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield subject_service_1.SubjectService.deleteSubject(req);
                res.status(204).send(); // no content
            }
            catch (err) {
                console.error("Error delete subject:", err);
                res
                    .status(400)
                    .json({ message: (err === null || err === void 0 ? void 0 : err.message) || "Failed to delete subject" });
            }
        });
    }
    static addQuestion(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const subject = yield subject_service_1.SubjectService.addQuestion(req);
                res.status(201).json(subject);
            }
            catch (err) {
                console.error("Error add question:", err);
                res.status(400).json({ message: (err === null || err === void 0 ? void 0 : err.message) || "Failed to add question" });
            }
        });
    }
    static deleteQuestion(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const subject = yield subject_service_1.SubjectService.deleteQuestion(req);
                res.json(subject);
            }
            catch (err) {
                console.error("Error delete question:", err);
                res.status(400).json({ message: (err === null || err === void 0 ? void 0 : err.message) || "Failed to delete question" });
            }
        });
    }
    static getSubjectandQuestion(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!req.params.sessionId || !req.params.campaign_id) {
                    return res.status(400).json({ message: "Missing sessionId or campaign_id" });
                }
                const subject = yield subject_service_1.SubjectService.getSubjectandQuestion(Number(req.params.sessionId), Number(req.params.campaign_id));
                res.json(subject);
            }
            catch (err) {
                console.error("Error get subject and question:", err);
                res.status(400).json({ message: (err === null || err === void 0 ? void 0 : err.message) || "Failed to get subject and question" });
            }
        });
    }
    static getSubjectQuestionByCamp(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!req.params.campaign_id) {
                    return res.status(400).json({ message: "Missing campaign_id" });
                }
                const subject = yield subject_service_1.SubjectService.getQuestionByCamp(Number(req.params.campaign_id));
                res.json(subject);
            }
            catch (err) {
                console.error("Error get subject and question:", err);
                res.status(400).json({ message: (err === null || err === void 0 ? void 0 : err.message) || "Failed to get subject and question" });
            }
        });
    }
}
exports.SubjectController = SubjectController;
