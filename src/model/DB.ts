import mysql, { Pool } from "mysql2/promise";

export class DB {
  private static instance: Pool;

  private constructor() {} // ป้องกันไม่ให้ new ตรงๆ

  public static getInstance(): Pool {
    if (!DB.instance) {
      DB.instance = mysql.createPool({
        host: "localhost",
        user: "root",
        password: "root",
        database: "Exam",
      });
      console.log("MySQL Pool created (Singleton)");
    }
    return DB.instance;
  }
  public static async testConnection(): Promise<boolean> {
    try {
      const pool = this.getInstance();
      const connection = await pool.getConnection();
      await connection.ping(); 
      connection.release();
      console.log("MySQL connected successfully");
      return true;
    } catch (error) {
      console.error("MySQL connection failed:", error);
      return false;
    }
  }
}
