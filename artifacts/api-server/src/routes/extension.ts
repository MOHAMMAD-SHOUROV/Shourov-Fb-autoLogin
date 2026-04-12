import { Router } from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const EXT_FILE = path.resolve(__dirname, "../../../../../attached_assets/Shourov-Fb-AutoLogin-Protected.zip");

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
