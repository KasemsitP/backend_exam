"use strict";
// src/utils/thaiDateTime.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.getThaiDateTimeString = getThaiDateTimeString;
exports.buildThaiDateTimeString = buildThaiDateTimeString;
function getThaiDateTimeString(date = new Date()) {
    const thaiTime = new Date(date.getTime() + 7 * 60 * 60 * 1000);
    const year = thaiTime.getUTCFullYear();
    const month = String(thaiTime.getUTCMonth() + 1).padStart(2, "0");
    const day = String(thaiTime.getUTCDate()).padStart(2, "0");
    const hours = String(thaiTime.getUTCHours()).padStart(2, "0");
    const minutes = String(thaiTime.getUTCMinutes()).padStart(2, "0");
    const seconds = String(thaiTime.getUTCSeconds()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
function buildThaiDateTimeString(examDate, timeHHmm) {
    const year = examDate.getFullYear();
    const month = String(examDate.getMonth() + 1).padStart(2, "0");
    const day = String(examDate.getDate()).padStart(2, "0");
    return `${year}-${month}-${day} ${timeHHmm}:00`;
}
