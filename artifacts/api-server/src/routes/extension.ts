import { Router } from "express";
import path from "path";
import fs from "fs";
import archiver from "archiver";
import { logger } from "../lib/logger";

const router = Router();

function findExtDir(): string {
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, "attached_assets", "koren_extracted"),
    path.resolve(cwd, "..", "..", "attached_assets", "koren_extracted"),
    path.resolve(cwd, "..", "attached_assets", "koren_extracted"),
    "/home/runner/workspace/attached_assets/koren_extracted",
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[candidates.length - 1];
}

const EXT_DIR = findExtDir();
logger.info({ ext_dir: EXT_DIR, exists: fs.existsSync(EXT_DIR) }, "Extension dir resolved");

router.get("/extension/download", (req, res) => {
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", 'attachment; filename="Shourov-Fb-AutoLogin.zip"');
  res.setHeader("Cache-Control", "no-store");

  const archive = archiver("zip", { zlib: { level: 9 } });

  archive.on("error", () => {
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to create extension zip" });
    }
  });

  archive.pipe(res);
  archive.directory(EXT_DIR, false);
  archive.finalize();
});

export default router;
