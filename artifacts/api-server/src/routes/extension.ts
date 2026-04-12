import { Router } from "express";
import path from "path";
import fs from "fs";

const router = Router();

const EXT_FILE = path.join(process.cwd(), "attached_assets", "Shourov-Fb-AutoLogin-Protected.zip");

router.get("/extension/download", (req, res) => {
  if (!fs.existsSync(EXT_FILE)) {
    res.status(404).json({ error: "Extension file not found" });
    return;
  }
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", 'attachment; filename="Shourov-Fb-AutoLogin.zip"');
  res.setHeader("Cache-Control", "no-store");
  res.sendFile(EXT_FILE);
});

export default router;
