import { Jwt } from "jsonwebtoken";
import bcrypt from 'bcrypt'

export class utills {
  static async hash(password: string): Promise<string> {
    const hashed = await bcrypt.hash(password, 10);
    return hashed;
  }

  static async bcryptCompare(password : string , userpassword: string ): Promise<boolean>{
    const match = await bcrypt.compare(password, userpassword);
    return match
  }
}
