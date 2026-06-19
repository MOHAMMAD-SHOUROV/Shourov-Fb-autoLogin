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
  downloadCount: number;
  users: Record<string, UserRecord>;
  lastResetAt?: string | null;
}

const DATA_FILE = path.join(process.cwd(), "admin_data.json");

const RESET_PERIOD_DAYS = 3;

export function readData(): AdminData {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const d = JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) as AdminData;
      if (!("broadcastMessage" in d)) d.broadcastMessage = null;
      if (!("extensionVersion" in d)) d.extensionVersion = "1.6.3";
      if (!("downloadCount" in d)) d.downloadCount = 0;
      if (!("lastResetAt" in d)) d.lastResetAt = new Date().toISOString();

      // Auto-reset loginCount every 3 days
      const lastReset = d.lastResetAt ? new Date(d.lastResetAt).getTime() : 0;
      const daysSinceReset = (Date.now() - lastReset) / (1000 * 60 * 60 * 24);
      if (daysSinceReset >= RESET_PERIOD_DAYS) {
        for (const uid of Object.keys(d.users)) {
          d.users[uid].loginCount = 0;
        }
        d.lastResetAt = new Date().toISOString();
        try { fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2)); } catch {}
        logger.info("Auto-reset: loginCount cleared after 3 days");
      }

      return d;
    }
  } catch (e) {
    logger.error(e, "Failed to read admin data");
  }
  return { extensionEnabled: true, broadcastMessage: null, extensionVersion: "1.6.3", downloadCount: 0, users: {}, lastResetAt: new Date().toISOString() };
}

export function writeData(data: AdminData): void {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    logger.error(e, "Failed to write admin data");
  }
}
