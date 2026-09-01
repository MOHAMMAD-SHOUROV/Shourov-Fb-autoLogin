import { logger } from "./logger";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

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

const RESET_PERIOD_DAYS = 3;
const SETTINGS_COLLECTION = "settings";
const USERS_COLLECTION = "users";
const SETTINGS_DOCUMENT = "global";

let firestore: Firestore | null = null;

function getDb(): Firestore {
  if (firestore) return firestore;

  const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!rawCredentials) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is required to use Firestore. Add the Firebase service-account JSON to Replit Secrets.",
    );
  }

  let credentials: {
    project_id?: string;
    client_email?: string;
    private_key?: string;
  };
  try {
    credentials = JSON.parse(rawCredentials) as typeof credentials;
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON must contain valid JSON.");
  }

  if (!credentials.project_id || !credentials.client_email || !credentials.private_key) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is missing project_id, client_email, or private_key.",
    );
  }

  const app =
    getApps()[0] ??
    initializeApp({
      credential: cert({
        projectId: credentials.project_id,
        clientEmail: credentials.client_email,
        privateKey: credentials.private_key.replace(/\\n/g, "\n"),
      }),
    });

  firestore = getFirestore(app);
  return firestore;
}

function defaultData(): AdminData {
  return {
    extensionEnabled: true,
    broadcastMessage: null,
    extensionVersion: "1.6.3",
    downloadCount: 0,
    users: {},
    lastResetAt: new Date().toISOString(),
  };
}

export async function readData(): Promise<AdminData> {
  const db = getDb();
  const [settingsSnapshot, usersSnapshot] = await Promise.all([
    db.collection(SETTINGS_COLLECTION).doc(SETTINGS_DOCUMENT).get(),
    db.collection(USERS_COLLECTION).get(),
  ]);

  const settings = settingsSnapshot.exists
    ? (settingsSnapshot.data() as Partial<AdminData>)
    : {};
  const data: AdminData = {
    ...defaultData(),
    ...settings,
    users: {},
  };

  for (const userSnapshot of usersSnapshot.docs) {
    data.users[userSnapshot.id] = userSnapshot.data() as UserRecord;
  }

  const lastReset = data.lastResetAt ? new Date(data.lastResetAt).getTime() : 0;
  const daysSinceReset = (Date.now() - lastReset) / (1000 * 60 * 60 * 24);
  if (daysSinceReset >= RESET_PERIOD_DAYS) {
    for (const user of Object.values(data.users)) user.loginCount = 0;
    data.lastResetAt = new Date().toISOString();
    await writeData(data);
    logger.info("Auto-reset: loginCount cleared after 3 days");
  }

  return data;
}

export async function writeData(data: AdminData): Promise<void> {
  const db = getDb();
  const existingUsers = await db.collection(USERS_COLLECTION).get();
  const operations = [
    {
      ref: db.collection(SETTINGS_COLLECTION).doc(SETTINGS_DOCUMENT),
      data: {
        extensionEnabled: data.extensionEnabled,
        broadcastMessage: data.broadcastMessage ?? null,
        extensionVersion: data.extensionVersion ?? "1.6.3",
        downloadCount: data.downloadCount ?? 0,
        lastResetAt: data.lastResetAt ?? new Date().toISOString(),
      },
    },
    ...Object.entries(data.users).map(([uid, user]) => ({
      ref: db.collection(USERS_COLLECTION).doc(uid),
      data: user,
    })),
  ];
  const activeUserIds = new Set(Object.keys(data.users));
  for (const userSnapshot of existingUsers.docs) {
    if (!activeUserIds.has(userSnapshot.id)) {
      operations.push({ ref: userSnapshot.ref, data: undefined as never });
    }
  }

  for (let index = 0; index < operations.length; index += 450) {
    const batch = db.batch();
    for (const operation of operations.slice(index, index + 450)) {
      if (operation.data === undefined) batch.delete(operation.ref);
      else batch.set(operation.ref, operation.data);
    }
    await batch.commit();
  }
}
