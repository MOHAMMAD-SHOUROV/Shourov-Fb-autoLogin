import { Router, Request, Response, NextFunction } from "express";
import { readData, writeData } from "../lib/admin-data";

const ADMIN_PASSWORD = "shourov247898";
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

router.get("/admin/stats", auth, (_req: Request, res: Response) => {
  const data = readData();
  const users = Object.values(data.users);
  res.json({
    totalUsers: users.length,
    blockedUsers: users.filter((u) => u.isBlocked).length,
    extensionEnabled: data.extensionEnabled,
  });
});

router.get("/admin/users", auth, (_req: Request, res: Response) => {
  const data = readData();
  const users = Object.values(data.users).sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  res.json({ users });
});

router.put("/admin/users/:uid/block", auth, (req: Request, res: Response) => {
  const data = readData();
  const uid = req.params.uid;
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
  writeData(data);
  res.json({ ok: true });
});

router.put(
  "/admin/users/:uid/unblock",
  auth,
  (req: Request, res: Response) => {
    const data = readData();
    if (data.users[req.params.uid]) {
      data.users[req.params.uid].isBlocked = false;
      writeData(data);
    }
    res.json({ ok: true });
  },
);

router.delete("/admin/users/:uid", auth, (req: Request, res: Response) => {
  const data = readData();
  delete data.users[req.params.uid];
  writeData(data);
  res.json({ ok: true });
});

router.put("/admin/extension/toggle", auth, (_req: Request, res: Response) => {
  const data = readData();
  data.extensionEnabled = !data.extensionEnabled;
  writeData(data);
  res.json({ ok: true, extensionEnabled: data.extensionEnabled });
});

export default router;
