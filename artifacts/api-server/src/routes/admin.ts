import { Router, Request, Response, NextFunction } from "express";
import { readData, writeData } from "../lib/admin-data";
import { rebuildExtensionCache } from "./extension";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "shourov247898";
const router = Router();

function auth(req: Request, res: Response, next: NextFunction) {
  if (req.headers["x-admin-password"] !== ADMIN_PASSWORD) {
    return void res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

router.post("/admin/auth", (req: Request, res: Response) => {
  const { password } = req.body as { password?: string };
  if (password !== ADMIN_PASSWORD) {
    return void res.status(401).json({ ok: false });
  }
  res.json({ ok: true });
});

router.get("/admin/stats", auth, async (_req: Request, res: Response) => {
  const data = await readData();
  const users = Object.values(data.users);
  res.json({
    totalUsers: users.length,
    blockedUsers: users.filter((u) => u.isBlocked).length,
    extensionEnabled: data.extensionEnabled,
    broadcastMessage: data.broadcastMessage ?? null,
    extensionVersion: data.extensionVersion ?? "1.6.3",
    downloadCount: data.downloadCount ?? 0,
  });
});

router.get("/admin/version", auth, async (_req: Request, res: Response) => {
  const data = await readData();
  res.json({ version: data.extensionVersion ?? "1.6.3" });
});

router.put("/admin/version", auth, async (req: Request, res: Response) => {
  const { version } = req.body as { version?: string };
  if (!version?.trim()) {
    return void res.status(400).json({ error: "version is required" });
  }
  const data = await readData();
  data.extensionVersion = version.trim();
  await writeData(data);
  res.json({ ok: true, version: data.extensionVersion });
  // Rebuild extension ZIP/CRX cache so next download has the updated version baked in
  rebuildExtensionCache().catch(() => {});
});

router.get("/admin/users", auth, async (_req: Request, res: Response) => {
  const data = await readData();
  const users = Object.values(data.users).sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  res.json({ users });
});

router.put("/admin/users/:uid/block", auth, async (req: Request, res: Response) => {
  const data = await readData();
  const uid = String(req.params.uid);
  if (!data.users[uid]) {
    data.users[uid] = {
      uid,
      isBlocked: true,
      loginCount: 0,
      lastSeen: null,
      createdAt: new Date().toISOString(),
    };
  } else {
    data.users[uid].isBlocked = true;
  }
  await writeData(data);
  res.json({ ok: true });
});

router.put(
  "/admin/users/:uid/unblock",
  auth,
  async (req: Request, res: Response) => {
    const data = await readData();
    const uid = String(req.params.uid);
    if (data.users[uid]) {
      data.users[uid].isBlocked = false;
      await writeData(data);
    }
    res.json({ ok: true });
  },
);

router.delete("/admin/users/:uid", auth, async (req: Request, res: Response) => {
  const data = await readData();
  delete data.users[String(req.params.uid)];
  await writeData(data);
  res.json({ ok: true });
});

router.put("/admin/extension/toggle", auth, async (_req: Request, res: Response) => {
  const data = await readData();
  data.extensionEnabled = !data.extensionEnabled;
  await writeData(data);
  res.json({ ok: true, extensionEnabled: data.extensionEnabled });
});

// Broadcast message — send notification to all extension popups
router.put("/admin/broadcast", auth, async (req: Request, res: Response) => {
  const { message } = req.body as { message?: string };
  const data = await readData();
  data.broadcastMessage = message?.trim() || null;
  await writeData(data);
  res.json({ ok: true, broadcastMessage: data.broadcastMessage });
});

router.delete("/admin/broadcast", auth, async (_req: Request, res: Response) => {
  const data = await readData();
  data.broadcastMessage = null;
  await writeData(data);
  res.json({ ok: true });
});

router.put("/admin/users/:uid/notify", auth, async (req: Request, res: Response) => {
  const { message } = req.body as { message?: string };
  const data = await readData();
  const uid = String(req.params.uid);
  if (!data.users[uid]) {
    return void res.status(404).json({ error: "User not found" });
  }
  data.users[uid].notification = message?.trim() || null;
  await writeData(data);
  res.json({ ok: true });
});

export default router;
