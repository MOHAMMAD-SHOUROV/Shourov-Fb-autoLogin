import { Router } from "express";
import path from "path";
import fs from "fs";
import archiver from "archiver";
import crypto from "crypto";
import { PassThrough } from "stream";
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

// ── Key management ─────────────────────────────────────────────
// CRX2 requires a persistent RSA key so the extension ID stays stable.
const KEY_PATH = path.join(EXT_DIR, "..", ".crx_key.pem");

function getOrCreateKey(): crypto.KeyObject {
  if (fs.existsSync(KEY_PATH)) {
    try {
      return crypto.createPrivateKey(fs.readFileSync(KEY_PATH, "utf8"));
    } catch {
      // corrupt key — regenerate
    }
  }
  const { privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;
  fs.writeFileSync(KEY_PATH, pem, { mode: 0o600 });
  return privateKey;
}

const PRIVATE_KEY = getOrCreateKey();
const PUBLIC_KEY  = crypto.createPublicKey(PRIVATE_KEY);

// ── Build ZIP buffer ────────────────────────────────────────────
function buildZipBuffer(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const pt = new PassThrough();
    pt.on("data", (c: Buffer) => chunks.push(c));
    pt.on("end", () => resolve(Buffer.concat(chunks)));
    pt.on("error", reject);

    const archive = archiver("zip", { zlib: { level: 6 } });
    archive.on("error", reject);
    archive.pipe(pt);
    archive.directory(EXT_DIR, false);
    archive.finalize();
  });
}

// ── Build CRX2 buffer ──────────────────────────────────────────
// CRX2 format: "Cr24" + LE uint32 version=2 + LE uint32 pubKeyLen +
//              LE uint32 sigLen + pubKeyDer + sig(SHA1) + zip
async function buildCrxBuffer(): Promise<Buffer> {
  const zip = await buildZipBuffer();

  // Public key in DER (SubjectPublicKeyInfo)
  const pubDer = PUBLIC_KEY.export({ type: "spki", format: "der" }) as Buffer;

  // Sign ZIP with SHA-1 (CRX2 spec)
  const signer = crypto.createSign("SHA1");
  signer.update(zip);
  const sig = signer.sign(PRIVATE_KEY);

  const magic   = Buffer.from("Cr24");
  const version = Buffer.allocUnsafe(4); version.writeUInt32LE(2, 0);
  const pubLen  = Buffer.allocUnsafe(4); pubLen.writeUInt32LE(pubDer.length, 0);
  const sigLen  = Buffer.allocUnsafe(4); sigLen.writeUInt32LE(sig.length, 0);

  return Buffer.concat([magic, version, pubLen, sigLen, pubDer, sig, zip]);
}

// ── Routes ─────────────────────────────────────────────────────

// Desktop: ZIP (load unpacked in Chrome/Chromium)
router.get("/extension/download", (req, res) => {
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", 'attachment; filename="Shourov-Fb-AutoLogin.zip"');
  res.setHeader("Cache-Control", "no-store");

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("error", () => {
    if (!res.headersSent) res.status(500).json({ error: "Failed to create extension zip" });
  });
  archive.pipe(res);
  archive.directory(EXT_DIR, false);
  archive.finalize();
});

// Mobile / Kiwi Browser: CRX (install directly, no unzipping needed)
router.get("/extension/download-crx", async (req, res) => {
  try {
    const crx = await buildCrxBuffer();
    res.setHeader("Content-Type", "application/x-chrome-extension");
    res.setHeader("Content-Disposition", 'attachment; filename="Shourov-Fb-AutoLogin.crx"');
    res.setHeader("Content-Length", String(crx.length));
    res.setHeader("Cache-Control", "no-store");
    res.send(crx);
  } catch (err) {
    logger.error(err, "CRX build failed");
    if (!res.headersSent) res.status(500).json({ error: "Failed to build CRX" });
  }
});

export default router;
