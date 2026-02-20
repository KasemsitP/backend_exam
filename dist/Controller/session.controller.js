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
exports.sessionController = void 0;
const session_service_1 = require("../Service/session.service");
class sessionController {
}
exports.sessionController = sessionController;
_a = sessionController;
sessionController.create = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const payload = req.body;
        const newSession = yield session_service_1.sessionService.create(payload);
        res.status(201).json(newSession);
    }
    catch (error) {
        res.status(400).send({ message: error.message });
    }
});
sessionController.delete = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            return res.status(400).send({ message: "Invalid ID format" });
        }
        console.log(id);
        yield session_service_1.sessionService.delete(id);
        res.status(204).send();
    }
    catch (error) {
        res.status(400).send({ message: error.message });
    }
});
