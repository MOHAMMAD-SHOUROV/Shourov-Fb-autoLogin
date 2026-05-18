import fs from "fs";
import path from "path";
import { logger } from "./logger";

export interface UserRecord {
  uid: string;
  name?: string;
  isBlocked: boolean;
  loginCount: number;
  lastSeen: string | null;
  createdAt: string;
  notification?: string | null;
}

export interface AdminData {
  extensionEnabled: boolean;
  broadcastMessage: string | null;
  extensionVersion: string;
  users: Record<string, UserRecord>;
}

const DATA_FILE = path.join(process.cwd(), "admin_data.json");

export function readData(): AdminData {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const d = JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) as AdminData;
      if (!("broadcastMessage" in d)) d.broadcastMessage = null;
      if (!("extensionVersion" in d)) d.extensionVersion = "1.6.3";
      return d;
    }
  } catch (e) {
    logger.error(e, "Failed to read admin data");
  }
  return { extensionEnabled: true, broadcastMessage: null, extensionVersion: "1.6.3", users: {} };
}

export function writeData(data: AdminData): void {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    logger.error(e, "Failed to write admin data");
  }
}
