// src/utils/thaiDateTime.ts

export function getThaiDateTimeString(date: Date = new Date()): string {
  const thaiTime = new Date(date.getTime() + 7 * 60 * 60 * 1000);

  const year = thaiTime.getUTCFullYear();
  const month = String(thaiTime.getUTCMonth() + 1).padStart(2, "0");
  const day = String(thaiTime.getUTCDate()).padStart(2, "0");
  const hours = String(thaiTime.getUTCHours()).padStart(2, "0");
  const minutes = String(thaiTime.getUTCMinutes()).padStart(2, "0");
  const seconds = String(thaiTime.getUTCSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function buildThaiDateTimeString(
  examDate: Date,
  timeHHmm: string
): string {
  const year = examDate.getFullYear();
  const month = String(examDate.getMonth() + 1).padStart(2, "0");
  const day = String(examDate.getDate()).padStart(2, "0");

  return `${year}-${month}-${day} ${timeHHmm}:00`;
}