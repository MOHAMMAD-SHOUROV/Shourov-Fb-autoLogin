import fs from "fs";
import path from "path";
import { logger } from "./logger";

export interface UserRecord {
  uid: string;
  isBlocked: boolean;
  loginCount: number;
  lastSeen: string | null;
  createdAt: string;
}

export interface AdminData {
  extensionEnabled: boolean;
  users: Record<string, UserRecord>;
}

const DATA_FILE = path.join(process.cwd(), "admin_data.json");

export function readData(): AdminData {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) as AdminData;
    }
  } catch (e) {
    logger.error(e, "Failed to read admin data");
  }
  return { extensionEnabled: true, users: {} };
}

export function writeData(data: AdminData): void {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    logger.error(e, "Failed to write admin data");
  }
}
