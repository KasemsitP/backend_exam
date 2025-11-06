import mysql, { Pool } from "mysql2/promise";

export class DB {
  private static instance: Pool;

  private constructor() { } // ป้องกันไม่ให้ new ตรงๆ

  public static getInstance(): Pool {
    if (!DB.instance) {
      // DB.instance = mysql.createPool({
      //   host: "localhost",
      //   user: "root",
      //   password: "root",
      //   database: "Exam",
      // });
      DB.instance = mysql.createPool({
        host: "gateway01.ap-southeast-1.prod.aws.tidbcloud.com",
        user: "bjQWWoB3iN7jDv7.root",
        password: "yKIXdDTrXIh0M0T5",
        database: "exam",
        port: 4000,
        ssl: {
          rejectUnauthorized: true, // ✅ ต้องเป็น object แบบนี้
        },
      });
      console.log("สร้าง MySQL Pool (Singleton) แล้ว");
    }
    return DB.instance;
  }
  public static async testConnection(): Promise<boolean> {
    try {
      const pool = this.getInstance();
      const connection = await pool.getConnection();
      await connection.ping();
      connection.release();
      console.log("เชื่อมต่อ MySQL สำเร็จ");
      return true;
    } catch (error) {
      console.error("เชื่อมต่อ MySQL ล้มเหลว:", error);
      return false;
    }
  }
}
