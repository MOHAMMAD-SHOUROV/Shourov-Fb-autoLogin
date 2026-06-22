import { Router } from "express";
import path from "path";
import fs from "fs";
import archiver from "archiver";
import crypto from "crypto";
import { PassThrough } from "stream";
import { logger } from "../lib/logger";
import JavaScriptObfuscator from "javascript-obfuscator";
import { readData, writeData } from "../lib/admin-data";

const router = Router();

// ── API URL injection ────────────────────────────────────────────
const OLD_API_HOST = "nusaiba-it-center-2478.onrender.com";
const OLD_API_URL  = `https://${OLD_API_HOST}`;
const API_BASE_URL     = process.env.API_BASE_URL ?? "";
const REPLIT_APP_URL   = process.env.REPLIT_APP_URL ?? "";
const REPLIT_DEV_DOMAIN = process.env.REPLIT_DEV_DOMAIN ?? "";
// API_BASE_URL takes priority — lets you pin the extension to Render or any domain
const API_BASE = API_BASE_URL
  ? API_BASE_URL
  : REPLIT_APP_URL
    ? REPLIT_APP_URL
    : REPLIT_DEV_DOMAIN
      ? `https://${REPLIT_DEV_DOMAIN}`
      : OLD_API_URL;

logger.info({ apiBase: API_BASE }, "Extension API base URL");

function patchApiUrl(source: string): string {
  return source.split(OLD_API_URL).join(API_BASE);
}

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

function obfuscateJs(source: string): string {
  try {
    const result = JavaScriptObfuscator.obfuscate(source, {
      compact: true,
      controlFlowFlattening: true,
      controlFlowFlatteningThreshold: 0.85,
      deadCodeInjection: true,
      deadCodeInjectionThreshold: 0.5,
      debugProtection: true,
      debugProtectionInterval: 2000,
      disableConsoleOutput: false,
      identifierNamesGenerator: "hexadecimal",
      log: false,
      numbersToExpressions: true,
      renameGlobals: false,
      selfDefending: true,
      simplify: true,
      splitStrings: true,
      splitStringsChunkLength: 5,
      stringArray: true,
      stringArrayCallsTransform: true,
      stringArrayCallsTransformThreshold: 0.85,
      stringArrayEncoding: ["rc4", "base64"],
      stringArrayIndexShift: true,
      stringArrayRotate: true,
      stringArrayShuffle: true,
      stringArrayWrappersCount: 5,
      stringArrayWrappersChunkLength: 3,
      stringArrayWrappersParametersMaxCount: 5,
      stringArrayWrappersType: "function",
      stringArrayThreshold: 0.95,
      transformObjectKeys: true,
      unicodeEscapeSequence: true,
    });
    return result.getObfuscatedCode();
  } catch (err) {
    logger.error(err, "Obfuscation failed — serving original source");
    return source;
  }
}

function obfuscateBg(source: string): string {
  try {
    const result = JavaScriptObfuscator.obfuscate(source, {
      compact: true,
      controlFlowFlattening: true,
      controlFlowFlatteningThreshold: 0.5,
      deadCodeInjection: false,
      debugProtection: false,
      disableConsoleOutput: false,
      identifierNamesGenerator: "hexadecimal",
      log: false,
      numbersToExpressions: true,
      renameGlobals: false,
      selfDefending: false,
      simplify: true,
      splitStrings: true,
      splitStringsChunkLength: 8,
      stringArray: true,
      stringArrayCallsTransform: true,
      stringArrayEncoding: ["rc4"],
      stringArrayIndexShift: true,
      stringArrayRotate: true,
      stringArrayShuffle: true,
      stringArrayWrappersCount: 2,
      stringArrayWrappersChunkLength: 2,
      stringArrayWrappersParametersMaxCount: 3,
      stringArrayWrappersType: "function",
      stringArrayThreshold: 0.8,
      transformObjectKeys: true,
      unicodeEscapeSequence: false,
    });
    return result.getObfuscatedCode();
  } catch (err) {
    logger.error(err, "Background obfuscation failed — serving original");
    return source;
  }
}

function minifyJson(source: string): string {
  try { return JSON.stringify(JSON.parse(source)); } catch { return source; }
}

function minifyHtml(source: string): string {
  try {
    return source
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/>\s+</g, "><")
      .replace(/\s{2,}/g, " ")
      .trim();
  } catch { return source; }
}

function minifyCss(source: string): string {
  try {
    return source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/[\r\n\t]+/g, " ")
      .replace(/\s{2,}/g, " ")
      .replace(/\s*([{}:;,>~+])\s*/g, "$1")
      .replace(/;}/g, "}")
      .trim();
  } catch { return source; }
}

function patchManifest(source: string): string {
  try {
    const manifest = JSON.parse(source) as { host_permissions?: string[] };
    if (!manifest.host_permissions) manifest.host_permissions = [];
    const extra = [
      "*://*.replit.dev/*",
      "*://*.replit.app/*",
      "*://*.pike.replit.dev/*",
      "*://*.sisko.replit.dev/*",
      "*://*.repl.co/*",
      "*://onrender.com/*",
      "*://*.onrender.com/*",
    ];
    for (const p of extra) {
      if (!manifest.host_permissions.includes(p)) {
        manifest.host_permissions.push(p);
      }
    }
    return JSON.stringify(manifest);
  } catch { return minifyJson(source); }
}

function patchVersion(source: string, version: string): string {
  return source.replace(/var myVersion\s*=\s*['"][^'"]*['"]/g, `var myVersion = '${version}'`);
}

function addExtensionFiles(archive: archiver.Archiver): void {
  const currentVersion = (readData().extensionVersion ?? "1.6.3").trim();
  const entries = fs.readdirSync(EXT_DIR, { recursive: true }) as string[];
  for (const rel of entries) {
    const full = path.join(EXT_DIR, rel);
    const stat = fs.statSync(full);
    if (!stat.isFile()) continue;
    if (path.basename(rel).startsWith(".")) continue;

    const name = path.basename(rel);

    if (name === "popup.js") {
      let raw = patchApiUrl(fs.readFileSync(full, "utf8"));
      raw = patchVersion(raw, currentVersion);
      archive.append(obfuscateJs(raw), { name: rel });
    } else if (name === "background.js") {
      const raw = patchApiUrl(fs.readFileSync(full, "utf8"));
      archive.append(obfuscateBg(raw), { name: rel });
    } else if (name === "manifest.json") {
      const raw = fs.readFileSync(full, "utf8");
      archive.append(patchManifest(raw), { name: rel });
    } else if (name === "popup.html") {
      const raw = fs.readFileSync(full, "utf8");
      archive.append(minifyHtml(raw), { name: rel });
    } else if (name === "popup.css") {
      const raw = fs.readFileSync(full, "utf8");
      archive.append(minifyCss(raw), { name: rel });
    } else {
      archive.file(full, { name: rel });
    }
  }
}

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
    addExtensionFiles(archive);
    archive.finalize();
  });
}

async function buildCrxBuffer(): Promise<Buffer> {
  const zip = await buildZipBuffer();

  const pubDer = PUBLIC_KEY.export({ type: "spki", format: "der" }) as Buffer;
  const signer = crypto.createSign("SHA1");
  signer.update(zip);
  const sig = signer.sign(PRIVATE_KEY);

  const magic   = Buffer.from("Cr24");
  const version = Buffer.allocUnsafe(4); version.writeUInt32LE(2, 0);
  const pubLen  = Buffer.allocUnsafe(4); pubLen.writeUInt32LE(pubDer.length, 0);
  const sigLen  = Buffer.allocUnsafe(4); sigLen.writeUInt32LE(sig.length, 0);

  return Buffer.concat([magic, version, pubLen, sigLen, pubDer, sig, zip]);
}

let cachedZip: Buffer | null = null;
let cachedCrx: Buffer | null = null;
let cacheReady = false;
let cacheError: Error | null = null;

async function warmCache(): Promise<void> {
  try {
    logger.info("Pre-building extension ZIP and CRX cache...");
    cachedZip = await buildZipBuffer();
    cachedCrx = await buildCrxBuffer();
    cacheReady = true;
    logger.info({ zipSize: cachedZip.length, crxSize: cachedCrx.length }, "Extension cache ready ✅");
  } catch (err) {
    cacheError = err as Error;
    logger.error(err, "Extension cache build failed");
  }
}

// Exported so admin routes can invalidate cache after version change
export async function rebuildExtensionCache(): Promise<void> {
  cachedZip = null;
  cachedCrx = null;
  cacheReady = false;
  await warmCache();
}

// Defer cache warm-up so it doesn't block port binding on startup
setImmediate(() => { warmCache().catch(() => {}); });

// ── Download routes ─────────────────────────────────────────────

router.get("/extension/download", async (_req, res) => {
  try {
    const zip = cachedZip ?? await buildZipBuffer();
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="Shourov-Fb-AutoLogin.zip"');
    res.setHeader("Content-Length", String(zip.length));
    res.setHeader("Cache-Control", "no-store");
    res.send(zip);
    // Track download count (fire-and-forget after response sent)
    try { const d = readData(); d.downloadCount = (d.downloadCount ?? 0) + 1; writeData(d); } catch {}
  } catch (err) {
    logger.error(err, "ZIP build failed");
    if (!res.headersSent) res.status(500).json({ error: "Failed to create extension zip" });
  }
});

router.get("/extension/download-crx", async (_req, res) => {
  try {
    const crx = cachedCrx ?? await buildCrxBuffer();
    res.setHeader("Content-Type", "application/x-chrome-extension");
    res.setHeader("Content-Disposition", 'attachment; filename="Shourov-Fb-AutoLogin.crx"');
    res.setHeader("Content-Length", String(crx.length));
    res.setHeader("Cache-Control", "no-store");
    res.send(crx);
    // Track download count (fire-and-forget after response sent)
    try { const d = readData(); d.downloadCount = (d.downloadCount ?? 0) + 1; writeData(d); } catch {}
  } catch (err) {
    logger.error(err, "CRX build failed");
    if (!res.headersSent) res.status(500).json({ error: "Failed to build CRX" });
  }
});

// ── Extension check — called by the extension before login ──────

router.get("/extension/check", (req, res) => {
  const uid = String(req.query.uid ?? "");
  const name = String(req.query.name ?? "").trim();
  const data = readData();

  const latestVersion = data.extensionVersion ?? "1.6.3";

  if (!data.extensionEnabled) {
    return void res.json({ allowed: false, reason: "Extension বন্ধ আছে (Admin দ্বারা)", broadcastMessage: data.broadcastMessage ?? null, notification: null, latestVersion });
  }
  if (uid && data.users[uid]?.isBlocked) {
    return void res.json({ allowed: false, reason: "আপনি Block করা আছেন। Admin এর সাথে যোগাযোগ করুন।", broadcastMessage: data.broadcastMessage ?? null, notification: null, latestVersion });
  }

  // Register/update user on first check-in (so they appear in admin panel before login)
  let dirty = false;
  if (uid) {
    if (!data.users[uid]) {
      data.users[uid] = {
        uid,
        name: name || undefined,
        isBlocked: false,
        loginCount: 0,
        lastSeen: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      dirty = true;
    } else {
      if (name && !data.users[uid].name) {
        data.users[uid].name = name;
        dirty = true;
      }
      data.users[uid].lastSeen = new Date().toISOString();
      dirty = true;
    }
  }

  // Return and clear any pending per-user notification
  let notification: string | null = null;
  if (uid && data.users[uid]?.notification) {
    notification = data.users[uid].notification ?? null;
    data.users[uid].notification = null;
    dirty = true;
  }

  if (dirty) writeData(data);

  res.json({ allowed: true, broadcastMessage: data.broadcastMessage ?? null, notification, latestVersion });
});

// ── Check name — public endpoint to check if a name is already used ──
router.get("/extension/check-name", (req, res) => {
  const name = ((req.query.name as string) || "").trim().toLowerCase();
  if (!name) return void res.json({ exists: false });
  const data = readData();
  const exists = Object.values(data.users).some(
    (u) => (u.name || "").trim().toLowerCase() === name,
  );
  res.json({ exists });
});

// ── Ping — extension registers user activity after login ────────

router.post("/extension/ping", (req, res) => {
  const { uid, name } = req.body as { uid?: string; name?: string };
  if (!uid) return void res.json({ ok: false });

  const data = readData();
  if (!data.users[uid]) {
    data.users[uid] = {
      uid,
      name: name?.trim() || undefined,
      isBlocked: false,
      loginCount: 0,
      lastSeen: null,
      createdAt: new Date().toISOString(),
    };
  } else {
    if (name?.trim()) {
      data.users[uid].name = name.trim();
    }
  }
  data.users[uid].loginCount = (data.users[uid].loginCount ?? 0) + 1;
  data.users[uid].lastSeen = new Date().toISOString();
  writeData(data);

  res.json({ ok: true });
});

export default router;
