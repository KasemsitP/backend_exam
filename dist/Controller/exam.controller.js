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
exports.examDataController = void 0;
const exam_service_1 = require("../Service/exam.service");
class examDataController {
}
exports.examDataController = examDataController;
_a = examDataController;
examDataController.getInitialData = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const data = yield exam_service_1.examDataService.getInitialData();
        res.status(200).json(data);
    }
    catch (error) {
        res.status(500).send({ message: error.message });
    }
});
