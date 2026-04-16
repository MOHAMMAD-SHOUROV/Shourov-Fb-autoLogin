import { Router } from "express";
import path from "path";
import fs from "fs";
import archiver from "archiver";
import crypto from "crypto";
import { PassThrough } from "stream";
import { logger } from "../lib/logger";
import JavaScriptObfuscator from "javascript-obfuscator";

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

// ── Obfuscate popup.js ─────────────────────────────────────────
// Transforms the JS so it is completely unreadable while remaining functional.
function obfuscateJs(source: string): string {
  try {
    const result = JavaScriptObfuscator.obfuscate(source, {
      compact: true,
      controlFlowFlattening: true,
      controlFlowFlatteningThreshold: 0.75,
      deadCodeInjection: true,
      deadCodeInjectionThreshold: 0.4,
      debugProtection: true,
      debugProtectionInterval: 4000,
      disableConsoleOutput: false,      // keep console for extension errors
      identifierNamesGenerator: "hexadecimal",
      log: false,
      numbersToExpressions: true,
      renameGlobals: false,             // chrome.*, document, etc. must stay intact
      selfDefending: true,              // resists beautifying/formatting tools
      simplify: true,
      splitStrings: true,
      splitStringsChunkLength: 8,
      stringArray: true,
      stringArrayCallsTransform: true,
      stringArrayCallsTransformThreshold: 0.75,
      stringArrayEncoding: ["base64"],
      stringArrayIndexShift: true,
      stringArrayRotate: true,
      stringArrayShuffle: true,
      stringArrayWrappersCount: 3,
      stringArrayWrappersChunkLength: 3,
      stringArrayWrappersParametersMaxCount: 4,
      stringArrayWrappersType: "function",
      stringArrayThreshold: 0.85,
      transformObjectKeys: true,
      unicodeEscapeSequence: false,
    });
    return result.getObfuscatedCode();
  } catch (err) {
    logger.error(err, "Obfuscation failed — serving original source");
    return source;
  }
}

// ── Minify JSON (manifest.json) ────────────────────────────────
function minifyJson(source: string): string {
  try {
    return JSON.stringify(JSON.parse(source));
  } catch {
    return source;
  }
}

// ── Minify HTML (popup.html) ────────────────────────────────────
function minifyHtml(source: string): string {
  try {
    return source
      // Remove HTML comments
      .replace(/<!--[\s\S]*?-->/g, "")
      // Remove whitespace between tags
      .replace(/>\s+</g, "><")
      // Collapse multiple spaces/tabs/newlines inside tags to single space
      .replace(/\s{2,}/g, " ")
      // Remove leading/trailing whitespace
      .trim();
  } catch {
    return source;
  }
}

// ── Minify CSS (popup.css) ──────────────────────────────────────
function minifyCss(source: string): string {
  try {
    return source
      // Remove /* ... */ comments
      .replace(/\/\*[\s\S]*?\*\//g, "")
      // Remove newlines and tabs
      .replace(/[\r\n\t]+/g, " ")
      // Collapse multiple spaces
      .replace(/\s{2,}/g, " ")
      // Remove spaces around punctuation that doesn't need them
      .replace(/\s*([{}:;,>~+])\s*/g, "$1")
      // Remove trailing semicolons before }
      .replace(/;}/g, "}")
      .trim();
  } catch {
    return source;
  }
}

// ── Add extension files to archiver — all files protected ──────
function addExtensionFiles(archive: archiver.Archiver): void {
  const entries = fs.readdirSync(EXT_DIR, { recursive: true }) as string[];
  for (const rel of entries) {
    const full = path.join(EXT_DIR, rel);
    const stat = fs.statSync(full);
    if (!stat.isFile()) continue;
    if (path.basename(rel).startsWith(".")) continue;

    const name = path.basename(rel);

    if (name === "popup.js") {
      const raw = fs.readFileSync(full, "utf8");
      archive.append(obfuscateJs(raw), { name: rel });
    } else if (name === "manifest.json") {
      const raw = fs.readFileSync(full, "utf8");
      archive.append(minifyJson(raw), { name: rel });
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
    addExtensionFiles(archive);
    archive.finalize();
  });
}

// ── Build CRX2 buffer ──────────────────────────────────────────
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

// ── Pre-built cache ────────────────────────────────────────────
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

// Start building immediately when the module loads
warmCache();

// ── Routes ─────────────────────────────────────────────────────

// Desktop: ZIP (load unpacked in Chrome/Chromium)
router.get("/extension/download", async (req, res) => {
  try {
    const zip = cachedZip ?? await buildZipBuffer();
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="Shourov-Fb-AutoLogin.zip"');
    res.setHeader("Content-Length", String(zip.length));
    res.setHeader("Cache-Control", "no-store");
    res.send(zip);
  } catch (err) {
    logger.error(err, "ZIP build failed");
    if (!res.headersSent) res.status(500).json({ error: "Failed to create extension zip" });
  }
});

// Mobile / Kiwi Browser: CRX
router.get("/extension/download-crx", async (req, res) => {
  try {
    const crx = cachedCrx ?? await buildCrxBuffer();
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
