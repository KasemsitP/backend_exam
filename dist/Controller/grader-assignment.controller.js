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
exports.graderAssignmentController = void 0;
const grader_assignment_service_1 = require("../Service/grader-assignment.service");
class graderAssignmentController {
}
exports.graderAssignmentController = graderAssignmentController;
_a = graderAssignmentController;
graderAssignmentController.createBulk = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _b;
    try {
        const { assignments } = req.body;
        if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
            return res
                .status(400)
                .send({ message: "assignments ต้องเป็น array และห้ามว่าง" });
        }
        yield grader_assignment_service_1.graderAssignmentService.createBulk(assignments);
        res.status(201).send({
            message: "สร้างการมอบหมายผู้ตรวจเรียบร้อย",
            count: assignments.length,
        });
    }
    catch (error) {
        console.error("Controller Error (graderAssignmentController.createBulk):", error);
        res
            .status(500)
            .send({ message: (_b = error === null || error === void 0 ? void 0 : error.message) !== null && _b !== void 0 ? _b : "Failed to create grader assignments" });
    }
});
