var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// dist-electron/main.js
var main_exports = {};
module.exports = __toCommonJS(main_exports);
var import_node_module = require("node:module");
var import_electron = require("electron");
var path = __toESM(require("path"), 1);
var fs = __toESM(require("fs"), 1);
var import_url = require("url");
var import_module = require("module");
var import_meta = {};
var __create2 = Object.create;
var __defProp2 = Object.defineProperty;
var __getOwnPropDesc2 = Object.getOwnPropertyDescriptor;
var __getOwnPropNames2 = Object.getOwnPropertyNames;
var __getProtoOf2 = Object.getPrototypeOf;
var __hasOwnProp2 = Object.prototype.hasOwnProperty;
var __commonJSMin = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __copyProps2 = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames2(from), i = 0, n = keys.length, key; i < n; i++) {
    key = keys[i];
    if (!__hasOwnProp2.call(to, key) && key !== except) __defProp2(to, key, {
      get: ((k) => from[k]).bind(null, key),
      enumerable: !(desc = __getOwnPropDesc2(from, key)) || desc.enumerable
    });
  }
  return to;
};
var __toESM2 = (mod, isNodeMode, target) => (target = mod != null ? __create2(__getProtoOf2(mod)) : {}, __copyProps2(isNodeMode || !mod || !mod.__esModule ? __defProp2(target, "default", {
  value: mod,
  enumerable: true
}) : target, mod));
var __require = typeof require !== "undefined" ? require : (0, import_node_module.createRequire)(import_meta.url || __filename);
var require_blockStats = /* @__PURE__ */ __commonJSMin(((exports2, module2) => {
  var { app: app$4 } = __require("electron");
  var path$4 = __require("path");
  var fs$4 = __require("fs");
  var blockStatsFile = () => path$4.join(app$4.getPath("userData"), "blockStats.json");
  var allBlockStats = {
    total: 0,
    domains: {}
  };
  var pendingBlockBatch = null;
  var blockBatchTimer = null;
  var blockSaveTimer = null;
  var _getMainWindow$1 = () => null;
  function init(getMainWindow$1) {
    _getMainWindow$1 = getMainWindow$1;
  }
  function loadBlockStats() {
    try {
      const raw = fs$4.readFileSync(blockStatsFile(), "utf8");
      const parsed = JSON.parse(raw);
      allBlockStats = {
        total: parsed.total || 0,
        domains: parsed.domains || {}
      };
    } catch {
      allBlockStats = {
        total: 0,
        domains: {}
      };
    }
  }
  function saveBlockStats() {
    try {
      fs$4.writeFileSync(blockStatsFile(), JSON.stringify({
        total: allBlockStats.total,
        domains: allBlockStats.domains
      }));
    } catch {
    }
  }
  function recordBlockedRequest(url) {
    let domain;
    try {
      domain = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return;
    }
    allBlockStats.total++;
    allBlockStats.domains[domain] = (allBlockStats.domains[domain] || 0) + 1;
    if (!pendingBlockBatch) pendingBlockBatch = {
      total: 0,
      domains: {}
    };
    pendingBlockBatch.total++;
    pendingBlockBatch.domains[domain] = (pendingBlockBatch.domains[domain] || 0) + 1;
    if (blockBatchTimer) clearTimeout(blockBatchTimer);
    blockBatchTimer = setTimeout(() => {
      blockBatchTimer = null;
      const mw = _getMainWindow$1();
      if (mw && !mw.isDestroyed() && pendingBlockBatch) mw.webContents.send("blocked-stats-update", pendingBlockBatch);
      pendingBlockBatch = null;
    }, 250);
    if (blockSaveTimer) clearTimeout(blockSaveTimer);
    blockSaveTimer = setTimeout(saveBlockStats, 3e3);
  }
  function getBlockStats() {
    return {
      total: allBlockStats.total,
      domains: allBlockStats.domains
    };
  }
  module2.exports = {
    init,
    loadBlockStats,
    recordBlockedRequest,
    getBlockStats
  };
}));
var require_storage = /* @__PURE__ */ __commonJSMin(((exports2, module2) => {
  var { app: app$3, ipcMain: ipcMain$4, safeStorage } = __require("electron");
  var path$3 = __require("path");
  var fs$3 = __require("fs");
  var _secureStoreFile = null;
  var secureStoreFile = () => _secureStoreFile || (_secureStoreFile = path$3.join(app$3.getPath("userData"), "secure-store.json"));
  var _secureStoreCache = null;
  function readSecureStore() {
    if (_secureStoreCache) return _secureStoreCache;
    try {
      _secureStoreCache = JSON.parse(fs$3.readFileSync(secureStoreFile(), "utf8"));
    } catch {
      _secureStoreCache = {};
    }
    return _secureStoreCache;
  }
  function writeSecureStore(data) {
    _secureStoreCache = data;
    fs$3.writeFileSync(secureStoreFile(), JSON.stringify(data));
  }
  function secureStoreGet(key) {
    const raw = readSecureStore()[key];
    if (!raw) return null;
    try {
      if (safeStorage.isEncryptionAvailable()) return safeStorage.decryptString(Buffer.from(raw, "base64"));
      return Buffer.from(raw, "base64").toString("utf8");
    } catch {
      return null;
    }
  }
  function secureStoreSet(key, value) {
    const store = readSecureStore();
    if (value === null || value === void 0 || value === "") delete store[key];
    else if (safeStorage.isEncryptionAvailable()) store[key] = safeStorage.encryptString(value).toString("base64");
    else store[key] = Buffer.from(value, "utf8").toString("base64");
    writeSecureStore(store);
  }
  var migrationFile = () => path$3.join(app$3.getPath("userData"), ".secret-migration.json");
  function writeSecretMigration() {
    try {
      const store = readSecureStore();
      const plain = {};
      for (const [k, raw] of Object.entries(store)) {
        if (!raw) continue;
        try {
          if (safeStorage.isEncryptionAvailable()) plain[k] = safeStorage.decryptString(Buffer.from(raw, "base64"));
          else plain[k] = Buffer.from(raw, "base64").toString("utf8");
        } catch {
        }
      }
      if (Object.keys(plain).length > 0) fs$3.writeFileSync(migrationFile(), JSON.stringify(plain), { mode: 384 });
    } catch {
    }
  }
  function applySecretMigrationIfNeeded() {
    const mf = migrationFile();
    if (!fs$3.existsSync(mf)) return;
    let plain = null;
    try {
      const raw = fs$3.readFileSync(mf, "utf8");
      try {
        fs$3.unlinkSync(mf);
      } catch {
        try {
          fs$3.writeFileSync(mf, "{}", { mode: 384 });
        } catch {
        }
      }
      plain = JSON.parse(raw);
    } catch {
      return;
    }
    if (!plain) return;
    for (const [k, v] of Object.entries(plain)) try {
      if (v) secureStoreSet(k, v);
    } catch {
    }
  }
  app$3.on("quit", () => {
    try {
      fs$3.unlinkSync(migrationFile());
    } catch {
    }
  });
  var scheduledBackupSettingsFile = () => path$3.join(app$3.getPath("userData"), "scheduled-backup-settings.json");
  function loadScheduledBackupSettings() {
    try {
      const raw = fs$3.readFileSync(scheduledBackupSettingsFile(), "utf8");
      return JSON.parse(raw);
    } catch {
      return {
        enabled: false,
        path: "",
        keepCount: 5,
        frequency: "startup",
        lastRun: null
      };
    }
  }
  function saveScheduledBackupSettings(settings) {
    fs$3.writeFileSync(scheduledBackupSettingsFile(), JSON.stringify(settings, null, 2), "utf8");
  }
  function shouldRunScheduledBackup(settings) {
    if (!settings.enabled || !settings.path) return false;
    if (settings.frequency === "startup") return true;
    if (!settings.lastRun) return true;
    const diff = Date.now() - new Date(settings.lastRun).getTime();
    if (settings.frequency === "daily") return diff >= 864e5;
    if (settings.frequency === "weekly") return diff >= 6048e5;
    if (settings.frequency === "monthly") return diff >= 2592e6;
    return false;
  }
  function register$3() {
    ipcMain$4.handle("get-app-version", () => app$3.getVersion());
    ipcMain$4.handle("secure-store-get", (_, key) => {
      try {
        return {
          ok: true,
          value: secureStoreGet(key)
        };
      } catch {
        return {
          ok: false,
          value: null
        };
      }
    });
    ipcMain$4.handle("secure-store-set", (_, { key, value }) => {
      try {
        secureStoreSet(key, value);
        return { ok: true };
      } catch (e) {
        return {
          ok: false,
          error: e.message
        };
      }
    });
    ipcMain$4.handle("get-scheduled-backup-settings", () => loadScheduledBackupSettings());
    ipcMain$4.handle("set-scheduled-backup-settings", (_, settings) => {
      try {
        saveScheduledBackupSettings(settings);
        return { ok: true };
      } catch (e) {
        return {
          ok: false,
          error: e.message
        };
      }
    });
    ipcMain$4.handle("perform-scheduled-backup", (_, { data, settings }) => {
      try {
        const backupDir = settings.path;
        if (!backupDir) return {
          ok: false,
          error: "No backup path set"
        };
        fs$3.mkdirSync(backupDir, { recursive: true });
        const filename = `streambert-backup-${(/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").slice(0, 19)}.json`;
        const fullPath = path$3.join(backupDir, filename);
        fs$3.writeFileSync(fullPath, JSON.stringify({
          version: 1,
          exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
          scheduledBackup: true,
          data
        }, null, 2), "utf8");
        const keepCount = Math.max(1, Number(settings.keepCount) || 5);
        fs$3.readdirSync(backupDir).filter((f) => f.startsWith("streambert-backup-") && f.endsWith(".json")).map((f) => ({
          name: f,
          mtime: fs$3.statSync(path$3.join(backupDir, f)).mtimeMs
        })).sort((a, b) => b.mtime - a.mtime).slice(keepCount).forEach(({ name }) => {
          try {
            fs$3.unlinkSync(path$3.join(backupDir, name));
          } catch {
          }
        });
        saveScheduledBackupSettings({
          ...settings,
          lastRun: (/* @__PURE__ */ new Date()).toISOString()
        });
        return {
          ok: true,
          path: fullPath
        };
      } catch (e) {
        return {
          ok: false,
          error: e.message
        };
      }
    });
  }
  module2.exports = {
    register: register$3,
    applySecretMigrationIfNeeded,
    writeSecretMigration,
    loadScheduledBackupSettings,
    shouldRunScheduledBackup
  };
}));
var require_downloads = /* @__PURE__ */ __commonJSMin(((exports2, module2) => {
  var { app: app$2, ipcMain: ipcMain$3, shell: shell$2, dialog, session: session$1 } = __require("electron");
  var { spawn: spawn$1 } = __require("child_process");
  var path$2 = __require("path");
  var fs$2 = __require("fs");
  var https$2 = __require("https");
  var http$2 = __require("http");
  var os$1 = __require("os");
  var downloads = [];
  var _downloadsFile = null;
  var downloadsFile = () => _downloadsFile || (_downloadsFile = path$2.join(app$2.getPath("userData"), "downloads.json"));
  var activeProcs = /* @__PURE__ */ new Map();
  var trustedBinaryPaths = /* @__PURE__ */ new Map();
  var _getMainWindow = () => null;
  function sendProgress(update) {
    const mw = _getMainWindow();
    if (mw && !mw.isDestroyed()) mw.webContents.send("download-progress", update);
  }
  function loadDownloads() {
    try {
      const raw = fs$2.readFileSync(downloadsFile(), "utf8");
      const parsed = JSON.parse(raw);
      const seen = /* @__PURE__ */ new Map();
      const sorted = [...parsed].sort((a, b) => (b.completedAt || b.startedAt || 0) - (a.completedAt || a.startedAt || 0));
      for (const d of sorted) {
        const key = d.tmdbId && d.mediaType ? `${d.tmdbId}|${d.mediaType}|${d.season ?? ""}|${d.episode ?? ""}` : d.id;
        if (!seen.has(key)) seen.set(key, d);
      }
      downloads = [...seen.values()];
    } catch {
      downloads = [];
    }
  }
  function saveDownloads() {
    try {
      const toSave = downloads.filter((d) => d.status !== "downloading" && d.status !== "error");
      fs$2.writeFileSync(downloadsFile(), JSON.stringify(toSave, null, 2));
    } catch {
    }
  }
  function cleanupTempFiles(downloadPath) {
    if (!downloadPath) return;
    const TEMP_PATTERNS = [
      /\.part$/,
      /\.part\.\d+$/,
      /\.part\.tmp$/,
      /\.tmp$/,
      /\.ytdl$/,
      /\.part-Frag\d+$/
    ];
    try {
      const entries = fs$2.readdirSync(downloadPath);
      for (const entry of entries) if (TEMP_PATTERNS.some((p) => p.test(entry))) try {
        fs$2.unlinkSync(path$2.join(downloadPath, entry));
      } catch {
      }
    } catch {
    }
  }
  function killAllDownloads() {
    for (const [id, proc] of activeProcs.entries()) {
      try {
        proc.kill("SIGKILL");
      } catch {
      }
      const idx = downloads.findIndex((d) => d.id === id);
      if (idx !== -1) {
        downloads[idx].status = "error";
        downloads[idx].lastMessage = "Cancelled on exit";
      }
      activeProcs.delete(id);
    }
    const folders = new Set(downloads.map((d) => d.downloadPath).filter(Boolean));
    for (const folder of folders) cleanupTempFiles(folder);
    saveDownloads();
  }
  function downloadSubtitleFile(url, destPath) {
    return new Promise((resolve) => {
      try {
        const parsedUrl = new URL(url);
        if (parsedUrl.protocol === "file:") {
          try {
            fs$2.copyFileSync(decodeURIComponent(parsedUrl.pathname), destPath);
            resolve(true);
          } catch {
            resolve(false);
          }
          return;
        }
        const req = (parsedUrl.protocol === "https:" ? https$2 : http$2).get(url, { headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
          Referer: parsedUrl.origin,
          Accept: "*/*"
        } }, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            downloadSubtitleFile(res.headers.location.startsWith("http") ? res.headers.location : parsedUrl.origin + res.headers.location, destPath).then(resolve);
            return;
          }
          if (res.statusCode !== 200) {
            res.resume();
            resolve(false);
            return;
          }
          const file = fs$2.createWriteStream(destPath);
          res.pipe(file);
          file.on("finish", () => {
            file.close();
            resolve(true);
          });
          file.on("error", () => {
            try {
              fs$2.unlinkSync(destPath);
            } catch {
            }
            resolve(false);
          });
          res.on("error", () => resolve(false));
        });
        req.on("error", () => resolve(false));
        req.setTimeout(2e4, () => {
          req.destroy();
          resolve(false);
        });
      } catch {
        resolve(false);
      }
    });
  }
  function register$2(getMainWindow$1) {
    _getMainWindow = getMainWindow$1;
    ipcMain$3.handle("check-downloader", (_, folderPath) => {
      if (!folderPath) return {
        exists: false,
        reason: "no_folder"
      };
      let entries;
      try {
        entries = fs$2.readdirSync(folderPath);
      } catch (e) {
        return {
          exists: false,
          reason: e.code === "EACCES" ? "folder_permission" : "folder_unreadable"
        };
      }
      if (!entries.includes("_internal")) return {
        exists: false,
        reason: "no_internal"
      };
      const binary = entries.find((e) => {
        if (e === "_internal" || e.startsWith(".")) return false;
        try {
          const stat = fs$2.statSync(path$2.join(folderPath, e));
          if (!stat.isFile()) return false;
          return process.platform === "win32" ? e.endsWith(".exe") : !!(stat.mode & 73);
        } catch {
          return false;
        }
      });
      if (!binary) return {
        exists: false,
        reason: "no_executable"
      };
      const token = crypto.randomUUID();
      trustedBinaryPaths.set(token, path$2.join(folderPath, binary));
      return {
        exists: true,
        token
      };
    });
    ipcMain$3.handle("run-download", (_, { token, m3u8Url, name, downloadPath, mediaId, mediaType, season, episode, posterPath, tmdbId, subtitles }) => {
      try {
        const binaryPath = trustedBinaryPaths.get(token);
        if (!binaryPath) return {
          ok: false,
          error: "Invalid or unknown downloader token"
        };
        const id = crypto.randomUUID();
        const logPath = path$2.join(os$1.tmpdir(), `streambert_dl_${id}.log`);
        const entry = {
          id,
          name,
          m3u8Url,
          downloadPath,
          filePath: null,
          status: "downloading",
          progress: 0,
          speed: "",
          size: "",
          totalFragments: 0,
          completedFragments: 0,
          lastMessage: "Starting\u2026",
          startedAt: Date.now(),
          completedAt: null,
          mediaId: mediaId || null,
          mediaType: mediaType || null,
          season: season || null,
          episode: episode || null,
          posterPath: posterPath || null,
          tmdbId: tmdbId || mediaId || null,
          subtitles: Array.isArray(subtitles) ? subtitles : [],
          subtitlePaths: [],
          logPath
        };
        try {
          fs$2.writeFileSync(logPath, `Streambert Download Log
Name: ${name}
URL: ${m3u8Url}
Started: ${(/* @__PURE__ */ new Date()).toISOString()}
${"\u2500".repeat(60)}
`, "utf8");
        } catch {
        }
        downloads.push(entry);
        const isSameMedia = (d) => d.id !== id && d.tmdbId && d.tmdbId === entry.tmdbId && d.mediaType === entry.mediaType && String(d.season ?? "") === String(entry.season ?? "") && String(d.episode ?? "") === String(entry.episode ?? "");
        downloads = downloads.filter((d) => !isSameMedia(d));
        const proc = spawn$1(binaryPath, [
          "--cli",
          m3u8Url,
          "-f",
          "mp4 (with Audio)",
          "-r",
          "best",
          "-b",
          "320",
          "-n",
          name,
          "-d",
          downloadPath
        ], { stdio: [
          "ignore",
          "pipe",
          "pipe"
        ] });
        activeProcs.set(id, proc);
        const handleLine = (line) => {
          const trimmed = line.trim();
          if (!trimmed) return;
          const idx = downloads.findIndex((d) => d.id === id);
          if (idx === -1) return;
          const update = {};
          const fragMatch = trimmed.match(/\(frag\s+(\d+)\/(\d+)\)/);
          if (fragMatch) {
            const currentFrag = parseInt(fragMatch[1]);
            const total = parseInt(fragMatch[2]);
            update.completedFragments = currentFrag;
            update.totalFragments = total;
            update.progress = Math.min(99, Math.round(currentFrag / total * 100));
            update.lastMessage = `Fragment ${currentFrag} / ${total}`;
          }
          if (!fragMatch && !downloads[idx].totalFragments) {
            const dlPctMatch = trimmed.match(/^\[download\]\s+([\d.]+)%\s+of\s+~?\s*([\d.]+\s*(?:[KMGT]i?B|B))/i);
            if (dlPctMatch) {
              const pct = parseFloat(dlPctMatch[1]);
              update.progress = Math.min(99, Math.round(pct));
              update.size = dlPctMatch[2].trim();
              const spMatch = trimmed.match(/\bat\s+([\d.]+\s*(?:[KMGT]i?B|B)\/s)/i);
              if (spMatch) update.speed = spMatch[1].trim();
              update.lastMessage = `${Math.round(pct)}% of ${update.size}`;
            }
          }
          const durationMatch = trimmed.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
          if (durationMatch) {
            const totalSecs = parseInt(durationMatch[1]) * 3600 + parseInt(durationMatch[2]) * 60 + parseFloat(durationMatch[3]);
            if (totalSecs > 0) downloads[idx]._ffmpegTotalSecs = totalSecs;
            return;
          }
          const ffmpegMatch = trimmed.match(/size=\s*([\d.]+\s*\w+)\s+time=(\d+):(\d+):([\d.]+)/i);
          if (ffmpegMatch) {
            const elapsedSecs = parseInt(ffmpegMatch[2]) * 3600 + parseInt(ffmpegMatch[3]) * 60 + parseFloat(ffmpegMatch[4]);
            const totalSecs = downloads[idx]._ffmpegTotalSecs || 0;
            if (totalSecs > 0) update.progress = Math.min(99, Math.round(elapsedSecs / totalSecs * 100));
            const rawSize = ffmpegMatch[1].trim();
            const kbMatch = rawSize.match(/([\d.]+)\s*kB/i);
            if (kbMatch) {
              const mb = parseFloat(kbMatch[1]) / 1024;
              update.size = mb >= 1024 ? `${(mb / 1024).toFixed(1)} GiB` : `${mb.toFixed(1)} MiB`;
            } else update.size = rawSize;
            const speedXMatch = trimmed.match(/speed=\s*([\d.]+)x/i);
            if (speedXMatch) update.speed = `${speedXMatch[1]}x`;
            update.lastMessage = `Processing\u2026 ${update.size}${update.speed ? ` at ${update.speed}` : ""}`;
          }
          if (trimmed.match(/Retrying\s+\(\d+\/\d+\)/i) || trimmed.match(/Got error:.*timed?\s*out/i) || trimmed.match(/Read timed? out/i)) {
            update.speed = "0 MB/s";
            const retryNumMatch = trimmed.match(/Retrying\s+\((\d+)\/(\d+)\)/i);
            update.lastMessage = retryNumMatch ? `Retrying\u2026 (${retryNumMatch[1]}/${retryNumMatch[2]})` : "Retrying\u2026";
            downloads[idx] = {
              ...downloads[idx],
              ...update
            };
            sendProgress({
              id,
              ...update,
              status: downloads[idx].status
            });
            return;
          }
          const speedMatch = trimmed.match(/\bat\s+([\d.]+\s*(?:[KMGT]i?B|B)\/s)/i);
          if (speedMatch) update.speed = speedMatch[1].trim();
          const sizeMatch = trimmed.match(/\bof\s+~?\s*([\d.]+\s*(?:[KMGT]i?B|B))\b/i);
          if (sizeMatch) update.size = sizeMatch[1].trim();
          const fragTotalMatch = trimmed.match(/Total fragments:\s+(\d+)/);
          if (fragTotalMatch) {
            const total = parseInt(fragTotalMatch[1]);
            const u = {
              totalFragments: total,
              completedFragments: 0,
              lastMessage: `HLS: ${total} fragments`
            };
            downloads[idx] = {
              ...downloads[idx],
              ...u
            };
            sendProgress({
              id,
              ...u,
              status: downloads[idx].status
            });
            return;
          }
          const destMatch = trimmed.match(/^\[download\] Destination:\s+(.+)/);
          if (destMatch) {
            const u = {
              filePath: destMatch[1].trim(),
              lastMessage: "Downloading\u2026"
            };
            downloads[idx] = {
              ...downloads[idx],
              ...u
            };
            sendProgress({
              id,
              ...u,
              status: downloads[idx].status
            });
            return;
          }
          const mergeMatch = trimmed.match(/\[Merger\] Merging formats into "(.+)"/);
          if (mergeMatch) {
            const u = {
              filePath: mergeMatch[1].trim(),
              lastMessage: "Merging\u2026",
              progress: 99
            };
            downloads[idx] = {
              ...downloads[idx],
              ...u
            };
            sendProgress({
              id,
              ...u,
              status: downloads[idx].status
            });
            return;
          }
          const SUPPRESS_PATTERNS = [
            /Sleeping\s+[\d.]+\s+seconds/i,
            /^\[yt-dlp\s+DEBUG\]/i,
            /^\[debug\]/i
          ];
          if (Object.keys(update).length === 0) {
            if (!(downloads[idx].lastMessage.startsWith("Fragment") || downloads[idx].lastMessage.startsWith("Retrying") || SUPPRESS_PATTERNS.some((p) => p.test(trimmed)))) update.lastMessage = trimmed;
          }
          if (Object.keys(update).length > 0) {
            downloads[idx] = {
              ...downloads[idx],
              ...update
            };
            sendProgress({
              id,
              ...update,
              status: downloads[idx].status
            });
          }
        };
        let buf = "";
        let stderrBuf = "";
        const appendLog = (line) => {
          try {
            fs$2.appendFileSync(logPath, line + "\n", "utf8");
          } catch {
          }
        };
        proc.stdout.on("data", (chunk) => {
          buf += chunk.toString();
          const lines = buf.split(/\r\n|\r|\n/);
          buf = lines.pop();
          lines.forEach((l) => {
            appendLog(l);
            handleLine(l);
          });
        });
        proc.stderr.on("data", (chunk) => {
          const text = chunk.toString();
          stderrBuf += text;
          text.split(/\r\n|\r|\n/).forEach((l) => {
            appendLog(l);
            handleLine(l);
          });
        });
        proc.on("error", (err) => {
          activeProcs.delete(id);
          const idx = downloads.findIndex((d) => d.id === id);
          if (idx === -1) return;
          const msg = err.code === "EACCES" ? `Permission denied, binary is not executable: ${binaryPath}` : err.code === "ENOENT" ? `Binary not found: ${binaryPath}` : `Failed to start downloader: ${err.message}`;
          downloads[idx].status = "error";
          downloads[idx].completedAt = Date.now();
          downloads[idx].lastMessage = msg;
          appendLog(msg);
          sendProgress({
            id,
            status: "error",
            lastMessage: msg
          });
        });
        proc.on("close", (code) => {
          activeProcs.delete(id);
          if (buf.trim()) {
            appendLog(buf.trim());
            handleLine(buf.trim());
          }
          const idx = downloads.findIndex((d) => d.id === id);
          if (idx === -1) return;
          const status = code === 0 ? "completed" : "error";
          downloads[idx].status = status;
          downloads[idx].completedAt = Date.now();
          if (code === 0) {
            downloads[idx].progress = 100;
            downloads[idx].logPath = null;
            try {
              fs$2.unlinkSync(logPath);
            } catch {
            }
          } else {
            try {
              fs$2.appendFileSync(logPath, `${"\u2500".repeat(60)}
Failed: exit code ${code}
Finished: ${(/* @__PURE__ */ new Date()).toISOString()}
`, "utf8");
            } catch {
            }
            const errorLine = stderrBuf.split(/\r\n|\r|\n/).map((l) => l.trim()).filter(Boolean).reverse().find((l) => /error|failed|unable|cannot|denied/i.test(l)) || "";
            const prev = downloads[idx].lastMessage || "";
            const base = errorLine || prev;
            downloads[idx].lastMessage = base ? `${base} (exit ${code})` : `Download failed (exit code ${code})`;
          }
          if (code === 0 && !downloads[idx].filePath) try {
            const VIDEO_EXTS = [
              ".mp4",
              ".mkv",
              ".webm",
              ".avi",
              ".ts",
              ".m4v"
            ];
            const match = fs$2.readdirSync(downloadPath).filter((f) => VIDEO_EXTS.some((e) => f.toLowerCase().endsWith(e))).map((f) => ({
              f,
              mtime: fs$2.statSync(path$2.join(downloadPath, f)).mtimeMs
            })).sort((a, b) => b.mtime - a.mtime)[0];
            if (match) downloads[idx].filePath = path$2.join(downloadPath, match.f);
          } catch {
          }
          if (code === 0 && downloads[idx].filePath) try {
            const ext = path$2.extname(downloads[idx].filePath) || ".mp4";
            const safeName = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "").replace(/\s+/g, " ").trim();
            if (safeName) {
              const newPath = path$2.join(downloadPath, safeName + ext);
              if (newPath !== downloads[idx].filePath) {
                fs$2.renameSync(downloads[idx].filePath, newPath);
                downloads[idx].filePath = newPath;
              }
            }
          } catch {
          }
          if (downloads[idx].filePath) try {
            const bytes = fs$2.statSync(downloads[idx].filePath).size;
            downloads[idx].size = bytes > 1e9 ? (bytes / 1e9).toFixed(2) + " GB" : bytes > 1e6 ? (bytes / 1e6).toFixed(1) + " MB" : bytes > 1e3 ? (bytes / 1e3).toFixed(1) + " KB" : bytes + " B";
          } catch {
          }
          if (code === 0 && downloads[idx].subtitles?.length > 0 && downloads[idx].filePath) {
            const videoBase = downloads[idx].filePath.replace(/\.[^.]+$/, "");
            const langCounter = {};
            const KNOWN_SUB_EXTS = [
              ".vtt",
              ".srt",
              ".ass",
              ".ssa",
              ".sub",
              ".idx"
            ];
            const subPromises = downloads[idx].subtitles.map(({ url, lang, name: subName, file_id }) => {
              const urlClean = url.split("?")[0].split("#")[0];
              const urlExt = path$2.extname(urlClean).toLowerCase().replace(/[^a-z0-9.]/g, "");
              const nameExt = subName ? path$2.extname(subName).toLowerCase().replace(/[^a-z0-9.]/g, "") : "";
              const subExt = KNOWN_SUB_EXTS.includes(urlExt) ? urlExt : KNOWN_SUB_EXTS.includes(nameExt) ? nameExt : ".srt";
              const safeLang = (lang || "unknown").replace(/[^a-z0-9_-]/gi, "");
              const lIdx = langCounter[safeLang] ?? 0;
              langCounter[safeLang] = lIdx + 1;
              const subDestPath = `${videoBase}.${safeLang}${lIdx > 0 ? `.${lIdx}` : ""}${subExt}`;
              return downloadSubtitleFile(url, subDestPath).then((ok) => ok ? {
                lang: lang || "unknown",
                path: subDestPath,
                file_id: file_id || null
              } : null);
            });
            Promise.all(subPromises).then((results) => {
              const i2 = downloads.findIndex((d) => d.id === id);
              if (i2 !== -1) {
                downloads[i2].subtitlePaths = results.filter(Boolean);
                saveDownloads();
                sendProgress({
                  id,
                  subtitlePaths: downloads[i2].subtitlePaths
                });
              }
            });
          }
          sendProgress({
            id,
            name,
            status: downloads[idx].status,
            progress: downloads[idx].progress,
            completedAt: downloads[idx].completedAt,
            filePath: downloads[idx].filePath,
            size: downloads[idx].size,
            completedFragments: downloads[idx].completedFragments,
            totalFragments: downloads[idx].totalFragments,
            lastMessage: downloads[idx].lastMessage,
            logPath: downloads[idx].logPath
          });
          saveDownloads();
        });
        return {
          ok: true,
          id
        };
      } catch (e) {
        return {
          ok: false,
          error: e.message
        };
      }
    });
    ipcMain$3.handle("get-downloads", () => downloads);
    ipcMain$3.handle("delete-download", (_, { id, filePath }) => {
      try {
        const dlEntry = downloads.find((d) => d.id === id);
        if (activeProcs.has(id)) {
          try {
            activeProcs.get(id).kill("SIGKILL");
          } catch {
          }
          activeProcs.delete(id);
        }
        if (filePath) try {
          if (fs$2.existsSync(filePath)) fs$2.unlinkSync(filePath);
        } catch {
        }
        for (const sp of dlEntry?.subtitlePaths || []) try {
          if (sp?.path && fs$2.existsSync(sp.path)) fs$2.unlinkSync(sp.path);
        } catch {
        }
        const dlPath = dlEntry?.downloadPath;
        if (dlPath) cleanupTempFiles(dlPath);
        downloads = downloads.filter((d) => d.id !== id);
        saveDownloads();
        return { ok: true };
      } catch (e) {
        return {
          ok: false,
          error: e.message
        };
      }
    });
    ipcMain$3.handle("delete-all-downloads", async () => {
      try {
        let deleted = 0, errors = 0;
        for (const dl of downloads) {
          if (dl.filePath) try {
            if (fs$2.existsSync(dl.filePath)) {
              fs$2.unlinkSync(dl.filePath);
              deleted++;
            }
          } catch {
            errors++;
          }
          for (const sp of dl.subtitlePaths || []) try {
            if (sp?.path && fs$2.existsSync(sp.path)) fs$2.unlinkSync(sp.path);
          } catch {
          }
        }
        downloads = [];
        saveDownloads();
        return {
          ok: true,
          deleted,
          errors
        };
      } catch (e) {
        return {
          ok: false,
          error: e.message
        };
      }
    });
    ipcMain$3.handle("get-downloads-size", async () => {
      let bytes = 0;
      await Promise.all(downloads.map(async (dl) => {
        if (!dl.filePath) return;
        try {
          const stat = await fs$2.promises.stat(dl.filePath);
          if (stat.isFile()) bytes += stat.size;
        } catch {
        }
      }));
      return { bytes };
    });
    ipcMain$3.handle("show-in-folder", (_, filePath) => {
      if (filePath && fs$2.existsSync(filePath)) shell$2.showItemInFolder(filePath);
      else shell$2.openPath(path$2.dirname(filePath || ""));
    });
    ipcMain$3.handle("file-exists", (_, filePath) => {
      try {
        return fs$2.existsSync(filePath);
      } catch {
        return false;
      }
    });
    ipcMain$3.handle("pick-folder", async () => {
      const mw = getMainWindow$1();
      if (!mw) return null;
      const result = await dialog.showOpenDialog(mw, {
        properties: ["openDirectory"],
        title: "Select Folder"
      });
      return result.canceled ? null : result.filePaths[0];
    });
    ipcMain$3.handle("open-external", (_, url) => {
      try {
        const parsed = new URL(url);
        if (parsed.protocol === "http:" || parsed.protocol === "https:") shell$2.openExternal(url);
      } catch {
      }
    });
    ipcMain$3.handle("open-path", (_, filePath) => {
      try {
        if (fs$2.statSync(filePath).isDirectory()) shell$2.openPath(filePath);
        else shell$2.showItemInFolder(filePath);
      } catch {
        shell$2.openPath(filePath);
      }
    });
    ipcMain$3.handle("get-install-path", () => {
      if (process.env.APPIMAGE) return path$2.dirname(process.env.APPIMAGE);
      if (app$2.isPackaged) return path$2.dirname(process.execPath);
      return app$2.getAppPath();
    });
    ipcMain$3.handle("scan-directory", (_, folderPath) => {
      try {
        if (!folderPath || !fs$2.existsSync(folderPath)) return [];
        const VIDEO_EXTS = [
          ".mp4",
          ".mkv",
          ".webm",
          ".avi",
          ".mov",
          ".m4v",
          ".ts"
        ];
        const results = [];
        const scanDir = (dir, depth = 0) => {
          if (depth > 3) return;
          let entries;
          try {
            entries = fs$2.readdirSync(dir, { withFileTypes: true });
          } catch {
            return;
          }
          for (const entry of entries) {
            const fullPath = path$2.join(dir, entry.name);
            if (entry.isDirectory()) scanDir(fullPath, depth + 1);
            else if (entry.isFile()) {
              const ext = path$2.extname(entry.name).toLowerCase();
              if (VIDEO_EXTS.includes(ext)) {
                let size = "";
                try {
                  const bytes = fs$2.statSync(fullPath).size;
                  size = bytes > 1e9 ? (bytes / 1e9).toFixed(2) + " GB" : bytes > 1e6 ? (bytes / 1e6).toFixed(1) + " MB" : bytes > 1e3 ? (bytes / 1e3).toFixed(1) + " KB" : bytes + " B";
                } catch {
                }
                results.push({
                  filePath: fullPath,
                  name: path$2.basename(entry.name, ext),
                  size,
                  ext
                });
              }
            }
          }
        };
        scanDir(folderPath);
        return results;
      } catch {
        return [];
      }
    });
    ipcMain$3.handle("clear-app-cache", async () => {
      try {
        const sessions = [
          session$1.defaultSession,
          session$1.fromPartition("persist:player"),
          session$1.fromPartition("persist:trailer")
        ];
        await Promise.all(sessions.map((s) => s.clearCache()));
        await Promise.all(sessions.map((s) => s.clearStorageData({ storages: [
          "shadercache",
          "serviceworkers",
          "cachestorage"
        ] })));
        return { ok: true };
      } catch (e) {
        return {
          ok: false,
          error: e.message
        };
      }
    });
    ipcMain$3.handle("clear-watch-data", async () => {
      try {
        const vs = session$1.fromPartition("persist:player");
        await vs.clearStorageData();
        await vs.clearCache();
        return { ok: true };
      } catch (e) {
        return {
          ok: false,
          error: e.message
        };
      }
    });
    ipcMain$3.handle("get-cache-size", async () => {
      try {
        const sessions = [
          session$1.defaultSession,
          session$1.fromPartition("persist:player"),
          session$1.fromPartition("persist:trailer")
        ];
        return { bytes: (await Promise.all(sessions.map((s) => s.getCacheSize()))).reduce((a, b) => a + b, 0) };
      } catch {
        return { bytes: 0 };
      }
    });
    ipcMain$3.handle("reset-app", async () => {
      try {
        const sessions = [
          session$1.defaultSession,
          session$1.fromPartition("persist:player"),
          session$1.fromPartition("persist:trailer")
        ];
        await Promise.all(sessions.map((s) => s.clearStorageData()));
        await Promise.all(sessions.map((s) => s.clearCache()));
        const dlFile = downloadsFile();
        if (fs$2.existsSync(dlFile)) fs$2.unlinkSync(dlFile);
        downloads = [];
        return { ok: true };
      } catch (e) {
        return {
          ok: false,
          error: e.message
        };
      }
    });
  }
  module2.exports = {
    register: register$2,
    loadDownloads,
    saveDownloads,
    killAllDownloads,
    getDownloads: () => downloads
  };
}));
var require_allmanga = /* @__PURE__ */ __commonJSMin(((exports2, module2) => {
  var { ipcMain: ipcMain$2 } = __require("electron");
  var https$1 = __require("https");
  var http$1 = __require("http");
  var crypto$1 = __require("crypto");
  var ALLANIME_HEX_MAP = {
    79: "A",
    "7a": "B",
    "7b": "C",
    "7c": "D",
    "7d": "E",
    "7e": "F",
    "7f": "G",
    70: "H",
    71: "I",
    72: "J",
    73: "K",
    74: "L",
    75: "M",
    76: "N",
    77: "O",
    68: "P",
    69: "Q",
    "6a": "R",
    "6b": "S",
    "6c": "T",
    "6d": "U",
    "6e": "V",
    "6f": "W",
    60: "X",
    61: "Y",
    62: "Z",
    59: "a",
    "5a": "b",
    "5b": "c",
    "5c": "d",
    "5d": "e",
    "5e": "f",
    "5f": "g",
    50: "h",
    51: "i",
    52: "j",
    53: "k",
    54: "l",
    55: "m",
    56: "n",
    57: "o",
    48: "p",
    49: "q",
    "4a": "r",
    "4b": "s",
    "4c": "t",
    "4d": "u",
    "4e": "v",
    "4f": "w",
    40: "x",
    41: "y",
    42: "z",
    "08": "0",
    "09": "1",
    "0a": "2",
    "0b": "3",
    "0c": "4",
    "0d": "5",
    "0e": "6",
    "0f": "7",
    "00": "8",
    "01": "9",
    15: "-",
    16: ".",
    67: "_",
    46: "~",
    "02": ":",
    17: "/",
    "07": "?",
    "1b": "#",
    63: "[",
    65: "]",
    78: "@",
    19: "!",
    "1c": "$",
    "1e": "&",
    10: "(",
    11: ")",
    12: "*",
    13: "+",
    14: ",",
    "03": ";",
    "05": "=",
    "1d": "%"
  };
  function decodeAllanimeUrl(encoded) {
    if (encoded.startsWith("--")) encoded = encoded.slice(2);
    let result = "";
    for (let i = 0; i < encoded.length; i += 2) {
      const pair = encoded.slice(i, i + 2);
      result += ALLANIME_HEX_MAP[pair] !== void 0 ? ALLANIME_HEX_MAP[pair] : pair;
    }
    return result.replace(/\\u002F/gi, "/").replace(/\\\|/g, "");
  }
  var ALLANIME_KEY = crypto$1.createHash("sha256").update("Xot36i3lK3:v1").digest();
  function decodeTobeparsed(blob) {
    try {
      const buf = Buffer.from(blob, "base64");
      const iv12 = buf.slice(1, 13);
      const iv16 = Buffer.concat([iv12, Buffer.from([
        0,
        0,
        0,
        2
      ])]);
      const ct = buf.slice(13, buf.length - 16);
      const decipher = crypto$1.createDecipheriv("aes-256-ctr", ALLANIME_KEY, iv16);
      decipher.setAutoPadding(false);
      const plain = Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
      const sources = [];
      for (const chunk of plain.split(/[{}]/)) {
        const urlMatch = chunk.match(/"sourceUrl"\s*:\s*"(--[^"]+)"/);
        const nameMatch = chunk.match(/"sourceName"\s*:\s*"([^"]+)"/);
        const prioMatch = chunk.match(/"priority"\s*:\s*([0-9.]+)/);
        if (urlMatch) sources.push({
          sourceUrl: urlMatch[1],
          sourceName: nameMatch ? nameMatch[1] : "",
          priority: prioMatch ? parseFloat(prioMatch[1]) : 0
        });
      }
      return sources;
    } catch {
      return [];
    }
  }
  function parseEpisodeSourceUrls(body) {
    const tbMatch = body.match(/"tobeparsed"\s*:\s*"([^"]+)"/);
    if (tbMatch) {
      const sources = decodeTobeparsed(tbMatch[1]);
      if (sources.length) return sources;
    }
    try {
      const sourceUrls = JSON.parse(body)?.data?.episode?.sourceUrls;
      return sourceUrls?.length ? sourceUrls : null;
    } catch {
      return null;
    }
  }
  function httpsGet(urlStr) {
    return new Promise((resolve, reject) => {
      function doGet(url) {
        const u = new URL(url);
        const req = https$1.request({
          hostname: u.hostname,
          path: u.pathname + u.search,
          method: "GET",
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
            Referer: "https://allmanga.to",
            Origin: "https://allmanga.to",
            Accept: "*/*"
          }
        }, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            const loc = res.headers.location.startsWith("http") ? res.headers.location : new URL(res.headers.location, url).href;
            res.resume();
            doGet(loc);
            return;
          }
          let data = "";
          res.on("data", (c) => data += c);
          res.on("end", () => resolve({
            status: res.statusCode,
            body: data
          }));
        });
        req.on("error", reject);
        req.setTimeout(12e3, () => {
          req.destroy();
          reject(/* @__PURE__ */ new Error("timeout"));
        });
        req.end();
      }
      doGet(urlStr);
    });
  }
  function followRedirects(urlStr, maxHops = 10) {
    return new Promise((resolve, reject) => {
      let hops = 0;
      function step(url) {
        if (++hops > maxHops) return resolve(url);
        let u;
        try {
          u = new URL(url);
        } catch {
          return reject(/* @__PURE__ */ new Error("invalid url: " + url));
        }
        const req = (u.protocol === "https:" ? https$1 : http$1).request({
          hostname: u.hostname,
          path: u.pathname + u.search,
          method: "HEAD",
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
            Referer: "https://allmanga.to",
            Accept: "*/*"
          }
        }, (res) => {
          res.resume();
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) step(res.headers.location.startsWith("http") ? res.headers.location : new URL(res.headers.location, url).href);
          else resolve(url);
        });
        req.on("error", reject);
        req.setTimeout(1e4, () => {
          req.destroy();
          reject(/* @__PURE__ */ new Error("timeout"));
        });
        req.end();
      }
      step(urlStr);
    });
  }
  function resolveWithYtdlp(youtubeUrl) {
    return new Promise((resolve) => {
      const { spawnSync: spawnSync$1 } = __require("child_process");
      if (spawnSync$1(process.platform === "win32" ? "where" : "which", ["yt-dlp"], { encoding: "utf8" }).status !== 0) return resolve(null);
      const result = spawnSync$1("yt-dlp", [
        "--no-playlist",
        "-f",
        "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "-g",
        youtubeUrl
      ], {
        encoding: "utf8",
        timeout: 3e4
      });
      if (result.status !== 0 || !result.stdout?.trim()) return resolve(null);
      resolve(result.stdout.trim().split("\n")[0]);
    });
  }
  function allanimeGQL(variables, query) {
    const body = JSON.stringify({
      variables,
      query
    });
    return new Promise((resolve, reject) => {
      const u = new URL("https://api.allanime.day/api");
      const req = https$1.request({
        hostname: u.hostname,
        path: u.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
          Referer: "https://allmanga.to",
          Origin: "https://allmanga.to"
        }
      }, (res) => {
        let data = "";
        res.on("data", (c) => data += c);
        res.on("end", () => resolve({
          status: res.statusCode,
          body: data
        }));
      });
      req.on("error", reject);
      req.setTimeout(12e3, () => {
        req.destroy();
        reject(/* @__PURE__ */ new Error("timeout"));
      });
      req.write(body);
      req.end();
    });
  }
  function sanitizeTitle(t) {
    return t.replace(/[''`´]/g, "").replace(/[:!.]/g, "").replace(/\s+/g, " ").trim();
  }
  function anilistSeasonTitle(baseTitle, seasonNumber) {
    return new Promise((resolve) => {
      const resolveS1 = seasonNumber <= 1;
      const body = JSON.stringify({
        query: `query($search:String){Media(search:$search,type:ANIME,sort:SEARCH_MATCH){title{english romaji}episodes relations{edges{relationType node{type format title{english romaji}episodes startDate{year}seasonYear}}}}}`,
        variables: { search: baseTitle }
      });
      const opts = {
        hostname: "graphql.anilist.co",
        path: "/",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Content-Length": Buffer.byteLength(body)
        }
      };
      const fallback = {
        title: baseTitle,
        romaji: null,
        episodes: null,
        nextTitle: null,
        nextRomaji: null
      };
      const req = https$1.request(opts, (res) => {
        let data = "";
        res.on("data", (c) => data += c);
        res.on("end", () => {
          try {
            const media = JSON.parse(data)?.data?.Media;
            if (!media) return resolve(fallback);
            const s1Romaji = media?.title?.romaji || null;
            const s1Episodes = media?.episodes || null;
            const sequels = (media.relations?.edges || []).filter((e) => e.relationType === "SEQUEL" && e.node.type === "ANIME" && (e.node.format === "TV" || e.node.format === "TV_SHORT")).sort((a, b) => {
              return (a.node.startDate?.year || a.node.seasonYear || 9999) - (b.node.startDate?.year || b.node.seasonYear || 9999);
            });
            const getTitle = (node) => node.title?.english || node.title?.romaji || null;
            const getRomaji = (node) => node.title?.romaji || null;
            if (resolveS1) {
              const next = sequels[0]?.node ?? null;
              return resolve({
                title: media.title?.english || baseTitle,
                romaji: s1Romaji,
                episodes: s1Episodes,
                nextTitle: next ? getTitle(next) : null,
                nextRomaji: next ? getRomaji(next) : null
              });
            }
            const target = sequels[seasonNumber - 2];
            if (!target) return resolve({
              ...fallback,
              romaji: s1Romaji
            });
            const nextNode = sequels[seasonNumber - 1]?.node ?? null;
            resolve({
              title: getTitle(target.node) || baseTitle,
              romaji: getRomaji(target.node) || s1Romaji,
              episodes: target.node.episodes || null,
              nextTitle: nextNode ? getTitle(nextNode) : null,
              nextRomaji: nextNode ? getRomaji(nextNode) : null
            });
          } catch {
            resolve(fallback);
          }
        });
      });
      req.on("error", () => resolve(fallback));
      req.setTimeout(8e3, () => {
        req.destroy();
        resolve(fallback);
      });
      req.write(body);
      req.end();
    });
  }
  var HARDCODED_SHOW_IDS = { "jojo's bizarre adventure": [
    "MeX4czvkwKGo3zdDp",
    "zyqDjR8te4z6taKyk",
    "GTAQH8Z9K6WbAdXsS",
    "JS9PzKiPanesGRvs5",
    "b6xFsr7MDSMcJArB9",
    "pwduJkjBLytqiWCvM"
  ] };
  var SPLIT_SEASONS = { "spy x family": { 1: [{
    from: 1,
    showId: null,
    offset: 0
  }, {
    from: 13,
    showId: "H8Aey6QXE7HSqwvW3",
    offset: 12
  }] } };
  var SEARCH_GQL = `query($search:SearchInput $limit:Int $page:Int $translationType:VaildTranslationTypeEnumType $countryOrigin:VaildCountryOriginEnumType){shows(search:$search limit:$limit page:$page translationType:$translationType countryOrigin:$countryOrigin){edges{_id name availableEpisodes __typename}}}`;
  var EPISODE_GQL = `query($showId:String! $translationType:VaildTranslationTypeEnumType! $episodeString:String!){episode(showId:$showId translationType:$translationType episodeString:$episodeString){episodeString sourceUrls}}`;
  var EPISODE_GQL_HASH = "d405d0edd690624b66baba3068e0edc3ac90f1597d898a1ec8db4e5c43c00fec";
  async function allanimeGQLEpisode(variables) {
    try {
      const encodedVars = encodeURIComponent(JSON.stringify(variables));
      const extensions = JSON.stringify({ persistedQuery: {
        version: 1,
        sha256Hash: EPISODE_GQL_HASH
      } });
      const getUrl = `https://api.allanime.day/api?variables=${encodedVars}&extensions=${encodeURIComponent(extensions)}`;
      const getRes = await new Promise((resolve, reject) => {
        const u = new URL(getUrl);
        const req = https$1.request({
          hostname: u.hostname,
          path: u.pathname + u.search,
          method: "GET",
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
            Referer: "https://allmanga.to",
            Origin: "https://youtu-chan.com",
            Accept: "*/*"
          }
        }, (res) => {
          let data = "";
          res.on("data", (c) => data += c);
          res.on("end", () => resolve({
            status: res.statusCode,
            body: data
          }));
        });
        req.on("error", reject);
        req.setTimeout(12e3, () => {
          req.destroy();
          reject(/* @__PURE__ */ new Error("timeout"));
        });
        req.end();
      });
      if (getRes.body && getRes.body.includes("tobeparsed")) return getRes;
    } catch {
    }
    return allanimeGQL(variables, EPISODE_GQL);
  }
  var PROVIDER_PRIORITY = [
    "S-mp4",
    "Luf-Mp4",
    "Yt-mp4",
    "Default",
    "Sl-Hls"
  ];
  async function resolveEpisodeFromId(showId, epStr, dubSub) {
    const candidates = [epStr];
    if (!epStr.includes(".")) candidates.push(epStr + ".0");
    let sourceUrls = null;
    for (const attempt of candidates) {
      const epRes = await allanimeGQLEpisode({
        showId,
        translationType: dubSub,
        episodeString: attempt
      });
      if (!epRes.body) continue;
      const urls = parseEpisodeSourceUrls(epRes.body);
      if (urls?.length) {
        sourceUrls = urls;
        break;
      }
    }
    if (!sourceUrls) return null;
    return trySourceUrls(sourceUrls);
  }
  async function trySourceUrls(sourceUrls) {
    const decodedSources = sourceUrls.filter((s) => s.sourceUrl?.startsWith("--")).map((s) => ({
      sourceName: s.sourceName || "",
      priority: s.priority || 0,
      path: decodeAllanimeUrl(s.sourceUrl).replace("/clock", "/clock.json")
    })).sort((a, b) => {
      const ai = PROVIDER_PRIORITY.indexOf(a.sourceName);
      const bi = PROVIDER_PRIORITY.indexOf(b.sourceName);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
    for (const src of decodedSources) {
      let fetchUrl = src.path;
      if (fetchUrl.startsWith("//")) fetchUrl = "https:" + fetchUrl;
      else if (fetchUrl.startsWith("/")) fetchUrl = "https://allanime.day" + fetchUrl;
      else if (!fetchUrl.startsWith("http")) fetchUrl = "https://allanime.day/" + fetchUrl;
      try {
        if (fetchUrl.includes("fast4speed.rsvp") || src.sourceName === "Yt-mp4") {
          const finalUrl = await followRedirects(fetchUrl).catch(() => null);
          if (!finalUrl) continue;
          let isGoogleVideoHost = false;
          try {
            const host = new URL(finalUrl).hostname.toLowerCase();
            isGoogleVideoHost = host === "googlevideo.com" || host.endsWith(".googlevideo.com");
          } catch {
            isGoogleVideoHost = false;
          }
          if (/\.(mp4|webm|mkv|m3u8)(\?|$)/i.test(finalUrl) || isGoogleVideoHost || !finalUrl.includes("youtube.com/watch") && !finalUrl.includes("youtu.be/")) return {
            ok: true,
            url: finalUrl,
            resolution: "?",
            sourceName: src.sourceName,
            isDirectMp4: !finalUrl.includes(".m3u8"),
            referer: "https://allmanga.to"
          };
          const ytStream = await resolveWithYtdlp(finalUrl).catch(() => null);
          if (ytStream) return {
            ok: true,
            url: ytStream,
            resolution: "?",
            sourceName: src.sourceName,
            isDirectMp4: true,
            referer: "https://www.youtube.com"
          };
          continue;
        }
        const linkRes = await httpsGet(fetchUrl);
        if (linkRes.status !== 200 || !linkRes.body) continue;
        let linkJson;
        try {
          linkJson = JSON.parse(linkRes.body);
        } catch {
          continue;
        }
        const links = linkJson?.links;
        if (!links?.length) continue;
        const allLinks = links.filter((l) => l.link);
        const mp4Links = allLinks.filter((l) => !l.link.includes(".m3u8") && !l.link.includes("master."));
        const best = (mp4Links.length ? mp4Links : allLinks).sort((a, b) => (parseInt(b.resolutionStr) || 0) - (parseInt(a.resolutionStr) || 0))[0];
        if (!best) continue;
        return {
          ok: true,
          url: best.link,
          resolution: best.resolutionStr || "?",
          sourceName: src.sourceName,
          isDirectMp4: !best.link.includes(".m3u8"),
          referer: "https://allmanga.to"
        };
      } catch {
        continue;
      }
    }
    return null;
  }
  var _playerServer = null;
  var _currentVideoUrl = null;
  var _currentVideoReferer = "https://allmanga.to";
  var _currentVideoStartTime = 0;
  function buildPlayerHtml(videoUrl, startTime) {
    const isM3u8 = videoUrl.includes(".m3u8");
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;background:#000;overflow:hidden}video{width:100%;height:100%;object-fit:contain;display:block}</style>
</head><body>
<video id="v" src="${isM3u8 ? "" : "/proxy?url=" + encodeURIComponent(videoUrl)}" autoplay controls playsinline crossorigin="anonymous"></video>
${isM3u8 ? `
<script src="https://cdn.jsdelivr.net/npm/hls.js@latest/dist/hls.min.js"></script>
<script>
  const video=document.getElementById('v');
  const src=decodeURIComponent("${encodeURIComponent(videoUrl)}");
  const startTime=${startTime};
  if(Hls.isSupported()){
    const hls=new Hls({xhrSetup:(xhr)=>xhr.setRequestHeader('Referer','${_currentVideoReferer}')});
    hls.loadSource(src);hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED,()=>{if(startTime>0)video.currentTime=startTime;video.play().catch(()=>{});});
  }else if(video.canPlayType('application/vnd.apple.mpegurl')){
    video.src=src;
    if(startTime>0)video.addEventListener('loadedmetadata',()=>{video.currentTime=startTime;},{once:true});
  }
</script>` : startTime > 0 ? `<script>
  const v=document.getElementById('v');
  v.addEventListener('loadedmetadata',()=>{v.currentTime=${startTime};},{once:true});
</script>` : ""}
</body></html>`;
  }
  function getPlayerServer() {
    if (_playerServer) return Promise.resolve(_playerServer);
    return new Promise((resolve, reject) => {
      const server = http$1.createServer((req, res) => {
        const url = new URL(req.url, "http://localhost");
        if (url.pathname === "/player" || url.pathname === "/") {
          res.writeHead(200, {
            "Content-Type": "text/html",
            "Cache-Control": "no-store"
          });
          res.end(buildPlayerHtml(_currentVideoUrl || "", _currentVideoStartTime || 0));
          return;
        }
        if (url.pathname === "/proxy") {
          const target = url.searchParams.get("url");
          if (!target) {
            res.writeHead(400);
            res.end();
            return;
          }
          try {
            const targetUrl = new URL(target);
            const proxyReq = (targetUrl.protocol === "https:" ? https$1 : http$1).request({
              hostname: targetUrl.hostname,
              path: targetUrl.pathname + targetUrl.search,
              method: req.method || "GET",
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
                Referer: _currentVideoReferer,
                Range: req.headers["range"] || "",
                Accept: "*/*"
              }
            }, (proxyRes) => {
              const passHeaders = {};
              for (const h of [
                "content-type",
                "content-length",
                "content-range",
                "accept-ranges",
                "last-modified",
                "etag"
              ]) if (proxyRes.headers[h]) passHeaders[h] = proxyRes.headers[h];
              passHeaders["Access-Control-Allow-Origin"] = "*";
              passHeaders["Cache-Control"] = "no-store";
              res.writeHead(proxyRes.statusCode, passHeaders);
              proxyRes.pipe(res);
            });
            proxyReq.on("error", () => {
              res.writeHead(502);
              res.end();
            });
            req.pipe(proxyReq);
          } catch {
            res.writeHead(500);
            res.end();
          }
          return;
        }
        res.writeHead(404);
        res.end();
      });
      server.listen(0, "127.0.0.1", () => {
        _playerServer = server;
        resolve(server);
      });
      server.on("error", reject);
    });
  }
  function register$1() {
    ipcMain$2.handle("set-player-video", async (_, { url, referer, startTime }) => {
      _currentVideoUrl = url;
      _currentVideoReferer = referer || "https://allmanga.to";
      _currentVideoStartTime = startTime || 0;
      return { playerUrl: `http://127.0.0.1:${(await getPlayerServer()).address().port}/player` };
    });
    ipcMain$2.handle("resolve-allmanga", async (_, { title, seasonNumber, episodeNumber, isMovie, translationType }) => {
      try {
        const season = seasonNumber || 1;
        const dubSub = translationType === "dub" ? "dub" : "sub";
        if (!isMovie) {
          const splitParts = SPLIT_SEASONS[title.toLowerCase()]?.[season];
          if (splitParts) {
            let activePart = splitParts[0];
            for (const part of splitParts) if (episodeNumber >= part.from) activePart = part;
            const partEp = episodeNumber - activePart.offset;
            if (activePart.showId) {
              const result$1 = await resolveEpisodeFromId(activePart.showId, String(partEp), dubSub);
              if (result$1) return result$1;
            }
          }
        }
        if (!isMovie) {
          const hardcodedIds = HARDCODED_SHOW_IDS[title.toLowerCase()];
          if (hardcodedIds) {
            const result$1 = await resolveEpisodeFromId(hardcodedIds[season - 1] ?? hardcodedIds[hardcodedIds.length - 1], String(episodeNumber), dubSub);
            if (result$1) return result$1;
          }
        }
        const anilistResult = isMovie ? {
          title,
          romaji: null,
          episodes: null,
          nextTitle: null,
          nextRomaji: null
        } : await anilistSeasonTitle(title, season);
        let searchTitle = anilistResult.title;
        let adjustedEpisodeNumber = episodeNumber;
        if (!isMovie && anilistResult.episodes && episodeNumber > anilistResult.episodes && anilistResult.nextTitle) {
          adjustedEpisodeNumber = episodeNumber - anilistResult.episodes;
          searchTitle = anilistResult.nextTitle;
        }
        const epStr = isMovie ? "1" : String(adjustedEpisodeNumber);
        const candidates = [.../* @__PURE__ */ new Set([
          searchTitle,
          sanitizeTitle(searchTitle),
          ...anilistResult.romaji && searchTitle === anilistResult.title ? [anilistResult.romaji] : [],
          ...anilistResult.nextRomaji && searchTitle === anilistResult.nextTitle ? [anilistResult.nextRomaji] : [],
          title,
          sanitizeTitle(title)
        ])].filter(Boolean);
        async function searchAllmanga(query) {
          const res = await allanimeGQL({
            search: {
              allowAdult: true,
              allowUnknown: false,
              query: query.toLowerCase()
            },
            limit: 40,
            page: 1,
            translationType: dubSub,
            countryOrigin: "ALL"
          }, SEARCH_GQL);
          if (!res.body) return null;
          try {
            const edges$1 = JSON.parse(res.body)?.data?.shows?.edges;
            return edges$1?.length ? edges$1 : null;
          } catch {
            return null;
          }
        }
        let edges = null, matchedTitle = searchTitle;
        for (const candidate of candidates) {
          edges = await searchAllmanga(candidate);
          if (edges) {
            matchedTitle = candidate;
            break;
          }
        }
        if (!edges) return {
          ok: false,
          error: "No results for: " + searchTitle
        };
        const titleLower = matchedTitle.toLowerCase();
        const anime = edges.find((e) => (e.name || "").toLowerCase() === titleLower) || edges[0];
        const epCandidates = [epStr];
        if (!epStr.includes(".")) epCandidates.push(epStr + ".0");
        let sourceUrls = null;
        for (const attempt of epCandidates) {
          const epRes = await allanimeGQLEpisode({
            showId: anime._id,
            translationType: dubSub,
            episodeString: attempt
          });
          if (!epRes.body) continue;
          const urls = parseEpisodeSourceUrls(epRes.body);
          if (urls?.length) {
            sourceUrls = urls;
            break;
          }
        }
        if (!sourceUrls?.length) return {
          ok: false,
          error: "No sourceUrls for ep " + epStr
        };
        const result = await trySourceUrls(sourceUrls);
        if (result) return {
          ...result,
          searchTitle
        };
        return {
          ok: false,
          error: "No playable link found"
        };
      } catch (e) {
        return {
          ok: false,
          error: e.message
        };
      }
    });
    ipcMain$2.handle("debug-allmanga", async (_, args) => {
      try {
        if (args.path) {
          const r$1 = await httpsGet(args.path.startsWith("http") ? args.path : "https://allmanga.to" + args.path);
          return {
            status: r$1.status,
            body: r$1.body.slice(0, 3e3)
          };
        }
        if (args.showId) {
          const r$1 = await allanimeGQLEpisode({
            showId: args.showId,
            translationType: "sub",
            episodeString: String(args.epNum || 1)
          });
          let parsed;
          try {
            parsed = JSON.parse(r$1.body);
          } catch {
          }
          const decodedUrls = parseEpisodeSourceUrls(r$1.body);
          if (decodedUrls?.length) parsed._decoded = decodedUrls.filter((s) => s.sourceUrl?.startsWith("--")).map((s) => {
            const p = decodeAllanimeUrl(s.sourceUrl).replace("/clock", "/clock.json");
            const fetchUrl = p.startsWith("//") ? "https:" + p : p.startsWith("/") ? "https://allanime.day" + p : p.startsWith("http") ? p : "https://allanime.day/" + p;
            return {
              sourceName: s.sourceName,
              path: p,
              fetchUrl
            };
          });
          return {
            status: r$1.status,
            parsed,
            raw: r$1.body.slice(0, 2e3)
          };
        }
        const season = args.season || 1;
        const resolvedTitle = await anilistSeasonTitle(args.title || "", season);
        const r = await allanimeGQL({
          search: {
            allowAdult: true,
            allowUnknown: false,
            query: resolvedTitle.toLowerCase()
          },
          limit: 10,
          page: 1,
          translationType: "sub",
          countryOrigin: "ALL"
        }, SEARCH_GQL);
        return {
          resolvedTitle,
          status: r.status,
          body: r.body.slice(0, 3e3)
        };
      } catch (e) {
        return { error: e.message };
      }
    });
  }
  module2.exports = { register: register$1 };
}));
var require_player = /* @__PURE__ */ __commonJSMin(((exports2, module2) => {
  var { ipcMain: ipcMain$1, shell: shell$1, app: app$1 } = __require("electron");
  var { spawn, spawnSync } = __require("child_process");
  var path$1 = __require("path");
  var fs$1 = __require("fs");
  var https = __require("https");
  var http = __require("http");
  var os = __require("os");
  var _updateAbortController = null;
  function register(getMainWindow$1, { writeSecretMigration: writeSecretMigration$1 }) {
    ipcMain$1.handle("open-path-at-time", (_, { filePath, seconds, subtitlePaths }) => {
      const sec = Math.floor(seconds || 0);
      const platform = process.platform;
      const resolveBin = (bin) => {
        if (path$1.isAbsolute(bin)) return fs$1.existsSync(bin) ? bin : null;
        const whichCmd = platform === "win32" ? "where" : "which";
        try {
          const result = spawnSync(whichCmd, [bin], { encoding: "utf8" });
          if (result.status === 0 && result.stdout.trim()) return result.stdout.trim().split("\n")[0].trim();
        } catch {
        }
        return null;
      };
      const tryLaunch = (bin, args) => {
        const resolved = resolveBin(bin);
        if (!resolved) return false;
        try {
          spawn(resolved, args, {
            detached: true,
            stdio: "ignore"
          }).unref();
          return true;
        } catch {
          return false;
        }
      };
      const vlcPaths = platform === "win32" ? [
        "C:\\Program Files\\VideoLAN\\VLC\\vlc.exe",
        "C:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe",
        "vlc"
      ] : platform === "darwin" ? ["/Applications/VLC.app/Contents/MacOS/VLC", "vlc"] : [
        "/usr/bin/vlc",
        "/usr/local/bin/vlc",
        "/snap/bin/vlc",
        "vlc"
      ];
      const mpvPaths = platform === "win32" ? ["mpv", "C:\\Program Files\\mpv\\mpv.exe"] : platform === "darwin" ? [
        "/opt/homebrew/bin/mpv",
        "/usr/local/bin/mpv",
        "mpv"
      ] : [
        "/usr/bin/mpv",
        "/usr/local/bin/mpv",
        "/snap/bin/mpv",
        "mpv"
      ];
      const subFilePaths = Array.isArray(subtitlePaths) ? subtitlePaths.map((sp) => typeof sp === "string" ? sp : sp?.path).filter((p) => p && fs$1.existsSync(p)) : [];
      const mpvSubArgs = subFilePaths.map((p) => `--sub-file=${p}`);
      const vlcSubArgs = subFilePaths.length > 0 ? [`--sub-file=${subFilePaths[0]}`] : [];
      if (sec > 0) {
        for (const mpv of mpvPaths) if (tryLaunch(mpv, [
          `--start=${sec}`,
          ...mpvSubArgs,
          filePath
        ])) return;
        for (const vlc of vlcPaths) if (tryLaunch(vlc, [
          `--start-time=${sec}`,
          ...vlcSubArgs,
          filePath
        ])) return;
      } else if (mpvSubArgs.length > 0) {
        for (const mpv of mpvPaths) if (tryLaunch(mpv, [...mpvSubArgs, filePath])) return;
        for (const vlc of vlcPaths) if (tryLaunch(vlc, [...vlcSubArgs, filePath])) return;
      }
      shell$1.openPath(filePath);
    });
    ipcMain$1.handle("window-minimize", () => {
      const mw = getMainWindow$1();
      if (mw && !mw.isDestroyed()) mw.minimize();
    });
    ipcMain$1.handle("window-toggle-maximize", () => {
      const mw = getMainWindow$1();
      if (!mw || mw.isDestroyed()) return;
      if (mw.isMaximized()) mw.unmaximize();
      else mw.maximize();
    });
    ipcMain$1.handle("window-close", () => {
      const mw = getMainWindow$1();
      if (mw && !mw.isDestroyed()) mw.close();
    });
    ipcMain$1.handle("window-is-maximized", () => {
      const mw = getMainWindow$1();
      return mw ? mw.isMaximized() : false;
    });
    const pushMaximized = (v) => {
      const mw = getMainWindow$1();
      if (mw && !mw.isDestroyed()) mw.webContents.send("window-maximized", v);
    };
    const mwForEvents = getMainWindow$1();
    if (mwForEvents) {
      mwForEvents.on("maximize", () => pushMaximized(true));
      mwForEvents.on("unmaximize", () => pushMaximized(false));
      mwForEvents.on("enter-full-screen", () => pushMaximized(true));
      mwForEvents.on("leave-full-screen", () => pushMaximized(false));
    }
    ipcMain$1.handle("quit-app", () => {
      const mw = getMainWindow$1();
      if (mw && !mw.isDestroyed()) mw.close();
    });
    ipcMain$1.handle("get-platform", () => process.platform);
    ipcMain$1.handle("get-video-duration", async (_, filePath) => {
      if (!filePath) return { ok: false };
      const platform = process.platform;
      const probePaths = platform === "win32" ? ["ffprobe", "C:\\ffmpeg\\bin\\ffprobe.exe"] : platform === "darwin" ? [
        "/opt/homebrew/bin/ffprobe",
        "/usr/local/bin/ffprobe",
        "ffprobe"
      ] : [
        "/usr/bin/ffprobe",
        "/usr/local/bin/ffprobe",
        "ffprobe"
      ];
      for (const probe of probePaths) try {
        const result = spawnSync(probe, [
          "-v",
          "error",
          "-show_entries",
          "format=duration",
          "-of",
          "default=noprint_wrappers=1:nokey=1",
          filePath
        ], {
          encoding: "utf8",
          timeout: 8e3
        });
        if (result.status === 0) {
          const secs = parseFloat(result.stdout.trim());
          if (!isNaN(secs) && secs > 0) return {
            ok: true,
            duration: secs
          };
        }
      } catch {
      }
      const ffmpegPaths = platform === "win32" ? ["ffmpeg", "C:\\ffmpeg\\bin\\ffmpeg.exe"] : platform === "darwin" ? [
        "/opt/homebrew/bin/ffmpeg",
        "/usr/local/bin/ffmpeg",
        "ffmpeg"
      ] : [
        "/usr/bin/ffmpeg",
        "/usr/local/bin/ffmpeg",
        "ffmpeg"
      ];
      for (const ff of ffmpegPaths) try {
        const r = spawnSync(ff, ["-i", filePath], {
          encoding: "utf8",
          timeout: 8e3
        });
        const m = ((r.stdout || "") + (r.stderr || "")).match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
        if (m) {
          const secs = parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseFloat(m[3]);
          if (secs > 0) return {
            ok: true,
            duration: secs
          };
        }
      } catch {
      }
      return { ok: false };
    });
    ipcMain$1.handle("detect-update-format", () => {
      if (process.platform === "win32") return "exe";
      if (process.platform === "darwin") return "dmg";
      if (process.platform === "linux") {
        if (process.env.APPIMAGE) return "appimage";
        return spawnSync("which", ["pacman"], { encoding: "utf8" }).status === 0 ? "pacman" : "deb";
      }
      return null;
    });
    ipcMain$1.handle("download-and-install-update", async (_, { url, format }) => {
      try {
        if (![
          "exe",
          "deb",
          "pacman",
          "dmg",
          "dmg_arm64",
          "appimage"
        ].includes(format)) return {
          ok: false,
          error: "Invalid format"
        };
        const TRUSTED_ORIGIN = "https://github.com";
        const TRUSTED_PATH = "/truelockmc/streambert/releases/download/";
        const ALLOWED_REDIRECT_HOSTS = [
          "github.com",
          "objects.githubusercontent.com",
          "release-assets.githubusercontent.com"
        ];
        let parsed;
        try {
          parsed = new URL(url);
        } catch {
          return {
            ok: false,
            error: "Invalid URL"
          };
        }
        if (parsed.origin !== TRUSTED_ORIGIN || !parsed.pathname.startsWith(TRUSTED_PATH)) return {
          ok: false,
          error: "Unauthorized update source"
        };
        _updateAbortController = new AbortController();
        const { signal } = _updateAbortController;
        const ext = format === "exe" ? ".exe" : format === "deb" ? ".deb" : format === "pacman" ? ".pacman" : format === "dmg" ? ".dmg" : ".AppImage";
        const destPath = path$1.join(os.tmpdir(), `streambert-update${ext}`);
        await new Promise((resolve, reject) => {
          if (signal.aborted) return reject(/* @__PURE__ */ new Error("Cancelled"));
          const doRequest = (reqUrl, redirectDepth = 0) => {
            if (redirectDepth > 5) return reject(/* @__PURE__ */ new Error("Too many redirects"));
            let reqParsed;
            try {
              reqParsed = new URL(reqUrl);
            } catch {
              return reject(/* @__PURE__ */ new Error("Invalid redirect URL"));
            }
            if (!ALLOWED_REDIRECT_HOSTS.includes(reqParsed.hostname)) return reject(/* @__PURE__ */ new Error(`Untrusted redirect host: ${reqParsed.hostname}`));
            const req = (reqUrl.startsWith("https") ? https : http).get(reqUrl, { headers: {
              "User-Agent": "Streambert-AutoUpdater",
              Accept: "application/octet-stream"
            } }, (res) => {
              if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                res.resume();
                doRequest(res.headers.location.startsWith("http") ? res.headers.location : new URL(res.headers.location, reqUrl).toString(), redirectDepth + 1);
                return;
              }
              if (res.statusCode !== 200) {
                res.resume();
                return reject(/* @__PURE__ */ new Error(`HTTP ${res.statusCode}`));
              }
              const total = parseInt(res.headers["content-length"] || "0", 10);
              let downloaded = 0;
              const file = fs$1.createWriteStream(destPath);
              res.on("data", (chunk) => {
                if (signal.aborted) {
                  req.destroy();
                  file.destroy();
                  reject(/* @__PURE__ */ new Error("Cancelled"));
                  return;
                }
                downloaded += chunk.length;
                file.write(chunk);
                const percent = total > 0 ? Math.round(downloaded / total * 100) : 0;
                const mb = (downloaded / 1e6).toFixed(1);
                const totalMb = total > 0 ? `/ ${(total / 1e6).toFixed(1)} MB` : "";
                const mw = getMainWindow$1();
                if (mw && !mw.isDestroyed()) mw.webContents.send("update-progress", {
                  percent,
                  label: `Downloading\u2026 ${mb} MB ${totalMb}`
                });
              });
              res.on("end", () => {
                file.end();
                file.on("finish", resolve);
                file.on("error", reject);
              });
              res.on("error", reject);
              req.on("error", reject);
            });
            req.on("error", reject);
          };
          doRequest(url);
        });
        if (signal.aborted) return {
          ok: false,
          error: "Cancelled"
        };
        const sendInstalling = () => {
          const mw = getMainWindow$1();
          if (mw && !mw.isDestroyed()) mw.webContents.send("update-progress", {
            percent: 100,
            label: "Installing\u2026"
          });
        };
        if (format === "appimage") {
          sendInstalling();
          fs$1.chmodSync(destPath, 493);
          const currentAppImage = process.env.APPIMAGE;
          if (currentAppImage) {
            const scriptPath = path$1.join(os.tmpdir(), "streambert-update.sh");
            const pid = process.pid;
            const target = currentAppImage;
            const scriptContent = [
              "#!/bin/sh",
              `while kill -0 ${pid} 2>/dev/null; do sleep 0.2; done`,
              `mv -f "${destPath}" "${target}"`,
              `chmod +x "${target}"`,
              `"${target}" &`
            ].join("\n") + "\n";
            fs$1.writeFileSync(scriptPath, scriptContent, { mode: 493 });
            spawn("sh", [scriptPath], {
              detached: true,
              stdio: "ignore"
            }).unref();
          } else spawn(destPath, [], {
            detached: true,
            stdio: "ignore"
          }).unref();
          writeSecretMigration$1();
          app$1.exit(0);
        } else if (format === "pacman") {
          sendInstalling();
          await new Promise((r) => setTimeout(r, 150));
          fs$1.chmodSync(destPath, 420);
          const pacmanLaunchers = [{
            bin: "pkexec",
            args: [
              "pacman",
              "-U",
              "--noconfirm",
              destPath
            ]
          }, {
            bin: "pamac-installer",
            args: [destPath]
          }];
          let launched = false;
          for (const { bin, args } of pacmanLaunchers) try {
            if (spawnSync("which", [bin], { encoding: "utf8" }).status !== 0) continue;
            if (spawnSync(bin, args, { stdio: "inherit" }).status === 0) {
              launched = true;
              break;
            }
          } catch {
            continue;
          }
          if (launched) {
            writeSecretMigration$1();
            app$1.relaunch();
            app$1.exit(0);
          } else shell$1.openPath(destPath);
        } else if (format === "deb") {
          sendInstalling();
          await new Promise((r) => setTimeout(r, 150));
          fs$1.chmodSync(destPath, 420);
          const debLaunchers = [
            {
              bin: "pkexec",
              args: [
                "dpkg",
                "-i",
                destPath
              ]
            },
            {
              bin: "pkexec",
              args: [
                "apt",
                "install",
                "-y",
                destPath
              ]
            },
            {
              bin: "gdebi-gtk",
              args: [destPath]
            },
            {
              bin: "pkexec",
              args: [
                "gdebi",
                "-n",
                destPath
              ]
            }
          ];
          let launched = false;
          for (const { bin, args } of debLaunchers) try {
            if (spawnSync(process.platform === "win32" ? "where" : "which", [bin], { encoding: "utf8" }).status !== 0) continue;
            if (spawnSync(bin, args, { stdio: "inherit" }).status === 0) {
              launched = true;
              break;
            }
          } catch {
            continue;
          }
          if (launched) {
            writeSecretMigration$1();
            app$1.relaunch();
            app$1.exit(0);
          } else shell$1.openPath(destPath);
        } else if (format === "exe") {
          sendInstalling();
          spawn(destPath, [], {
            detached: true,
            stdio: "ignore"
          }).unref();
          app$1.exit(0);
        } else if (format === "dmg") {
          sendInstalling();
          spawn("hdiutil", ["attach", destPath], {
            detached: true,
            stdio: "ignore"
          }).unref();
        }
        return { ok: true };
      } catch (e) {
        return {
          ok: false,
          error: e.message
        };
      } finally {
        _updateAbortController = null;
      }
    });
    ipcMain$1.handle("cancel-update", () => {
      _updateAbortController?.abort();
    });
    ipcMain$1.handle("query-video-progress", async (_, webContentsId) => {
      try {
        const { webContents: webContents$1 } = __require("electron");
        const wc = webContents$1.fromId(webContentsId);
        if (!wc || wc.isDestroyed()) return null;
        const allFrames = [];
        const collect = (frame) => {
          allFrames.push(frame);
          for (const child of frame.frames || []) collect(child);
        };
        collect(wc.mainFrame);
        const JS = `
        (() => {
          const v = document.querySelector('video');
          if (!v || !v.duration || v.duration === Infinity || v.paused) return null;
          if (!v._seekTracked) {
            v._seekTracked = true;
            v.addEventListener('seeked', () => {
              v._lastUserSeek = Date.now();
              v._lastUserSeekTo = v.currentTime;
            });
          }
          return {
            currentTime: v.currentTime,
            duration: v.duration,
            recentUserSeek: v._lastUserSeek ? (Date.now() - v._lastUserSeek < 6000) : false,
            lastUserSeekTo: v._lastUserSeekTo ?? null,
          };
        })()
      `;
        for (const frame of allFrames) try {
          const result = await frame.executeJavaScript(JS);
          if (result && result.duration > 0) return result;
        } catch {
        }
        return null;
      } catch {
        return null;
      }
    });
  }
  module2.exports = { register };
}));
var import_blockStats = /* @__PURE__ */ __toESM2(require_blockStats(), 1);
var import_storage = /* @__PURE__ */ __toESM2(require_storage(), 1);
var import_downloads = /* @__PURE__ */ __toESM2(require_downloads(), 1);
var import_allmanga = /* @__PURE__ */ __toESM2(require_allmanga(), 1);
var import_player = /* @__PURE__ */ __toESM2(require_player(), 1);
(0, import_module.createRequire)(import_meta.url);
var __filename = (0, import_url.fileURLToPath)(import_meta.url);
var __dirname = path.dirname(__filename);
import_electron.app.commandLine.appendSwitch("js-flags", "--max-old-space-size=256 --expose-gc");
import_electron.app.commandLine.appendSwitch("disable-features", "HardwareMediaKeyHandling,MediaSessionService,UseSandboxedXdgPortal");
import_electron.app.commandLine.appendSwitch("enable-features", "NetworkServiceInProcess2");
import_electron.app.commandLine.appendSwitch("disk-cache-size", String(80 * 1024 * 1024));
import_electron.app.commandLine.appendSwitch("renderer-process-limit", "3");
var userDataPath = import_electron.app.getPath("userData");
var envPath = path.join(userDataPath, ".env");
var isDev = process.env.NODE_ENV === "development" || !import_electron.app.isPackaged;
if (!fs.existsSync(envPath)) {
  const bundledEnvPath = isDev ? path.join(__dirname, "../../.env.example") : path.join(process.resourcesPath, ".env.example");
  if (fs.existsSync(bundledEnvPath)) fs.copyFileSync(bundledEnvPath, envPath);
  else fs.writeFileSync(envPath, "# Yorumi User Configuration\n\n# TMDB_API_KEY=\n");
}
try {
  const envContent = fs.readFileSync(envPath, "utf8");
  envContent.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "").trim();
    }
  });
} catch (e) {
}
var mainWindow = null;
var getMainWindow = () => mainWindow;
var playerWcIds = /* @__PURE__ */ new Set();
var sessionsConfigured = false;
var VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
var BLOCKED_HOSTS = [
  "*://www.google-analytics.com/*",
  "*://analytics.google.com/*",
  "*://googletagmanager.com/*",
  "*://www.googletagmanager.com/*",
  "*://googletagservices.com/*",
  "*://doubleclick.net/*",
  "*://*.doubleclick.net/*",
  "*://adservice.google.com/*",
  "*://adservice.google.de/*",
  "*://pagead2.googlesyndication.com/*",
  "*://stats.g.doubleclick.net/*",
  "*://yt3.ggpht.com/ytc/*",
  "*://fonts.googleapis.com/*",
  "*://fonts.gstatic.com/*",
  "*://googleapis.com/*",
  "*://gstatic.com/*",
  "*://cdn.adx1.com/*",
  "*://intelligenceadx.com/*",
  "*://adsco.re/*",
  "*://mc.yandex.com/*",
  "*://mc.yandex.ru/*",
  "*://bvtpk.com/*",
  "*://my.rtmark.net/*",
  "*://bvtpk.com/*",
  "*://b7510.com/*",
  "*://gt.unbrownunflat.com/*",
  "*://im.malocacomals.com/*",
  "*://users.videasy.net/*",
  "*://nf.sixmossin.com/*",
  "*://realizationnewestfangs.com/*",
  "*://acscdn.com/*",
  "*://lt.taloseempest.com/*",
  "*://pl26708123.profitableratecpm.com/*",
  "*://preferencenail.com/*",
  "*://protrafficinspector.com/*",
  "*://s10.histats.com/*",
  "*://weirdopt.com/*",
  "*://static.cloudflareinsights.com/*",
  "*://kettledroopingcontinuation.com/*",
  "*://wayfarerorthodox.com/*",
  "*://woxaglasuy.net/*",
  "*://adeptspiritual.com/*",
  "*://www.calculating-laugh.com/*",
  "*://amavhxdlofklxjg.xyz/*",
  "*://7jtjubf8p5kq7x3z2.u3qleufcm6vure326ktfpbj.cfd/*",
  "*://5mq.get64t9vqg8pnbex1y463o.rest/*",
  "*://usrpubtrk.com/*",
  "*://adexchangeclear.com/*",
  "*://rzjzjnavztycv.online/*",
  "*://tmstr4.cloudnestra.com/*",
  "*://tmstr4.neonhorizonworkshops.com/*"
];
function setupSession(playerSession, trailerSession) {
  const stripHeaders = (details, callback) => {
    const headers = { ...details.responseHeaders };
    for (const key of Object.keys(headers)) {
      const lower = key.toLowerCase();
      if (lower === "x-frame-options" || lower === "content-security-policy") delete headers[key];
    }
    callback({ responseHeaders: headers });
  };
  const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
  playerSession.setUserAgent(UA);
  trailerSession.setUserAgent(UA);
  playerSession.webRequest.onHeadersReceived({ urls: ["*://*/*"] }, stripHeaders);
  trailerSession.webRequest.onHeadersReceived({ urls: ["*://*/*"] }, stripHeaders);
  trailerSession.webRequest.onBeforeRequest({ urls: BLOCKED_HOSTS }, (_, cb) => cb({ cancel: true }));
  const MEDIA_URLS = [
    "*://*/*.m3u8*",
    "*://*/*.m3u8",
    "*://*/*.vtt*",
    "*://*/*.vtt"
  ];
  playerSession.webRequest.onBeforeRequest({ urls: [...BLOCKED_HOSTS, ...MEDIA_URLS] }, (details, callback) => {
    const { url } = details;
    if (!(url.includes(".m3u8") || url.includes(".vtt"))) {
      import_blockStats.default.recordBlockedRequest(url);
      callback({ cancel: true });
      return;
    }
    try {
      const host = new URL(url).hostname;
      if (BLOCKED_HOSTS.some((pat) => {
        const hostPat = pat.replace(/^\*:\/\//, "").split("/")[0];
        return hostPat.startsWith("*.") ? host.endsWith(hostPat.slice(1)) : host === hostPat || host === hostPat.replace(/^\*\./, "");
      })) {
        import_blockStats.default.recordBlockedRequest(url);
        callback({ cancel: true });
        return;
      }
    } catch {
    }
    const mw = getMainWindow();
    if (mw && !mw.isDestroyed()) {
      if (url.includes(".m3u8")) mw.webContents.send("m3u8-found", url);
      else if (url.includes(".vtt")) {
        const langMatch = url.match(/_([a-z]{2})\.vtt/i);
        mw.webContents.send("subtitle-found", {
          url,
          lang: langMatch ? langMatch[1] : "en"
        });
      }
    }
    callback({});
  });
  const ytCookie = {
    url: "https://www.youtube.com",
    name: "SOCS",
    value: "CAI",
    path: "/",
    secure: true,
    httpOnly: false,
    sameSite: "no_restriction",
    expirationDate: Math.floor(Date.now() / 1e3) + 3600 * 24 * 365 * 2
  };
  for (const domain of [".youtube.com", ".youtube-nocookie.com"]) {
    const cookie = {
      ...ytCookie,
      domain
    };
    trailerSession.cookies.set(cookie).catch(() => {
    });
    playerSession.cookies.set(cookie).catch(() => {
    });
  }
}
function createWindow() {
  import_storage.default.applySecretMigrationIfNeeded();
  import_downloads.default.loadDownloads();
  import_blockStats.default.loadBlockStats();
  mainWindow = new import_electron.BrowserWindow({
    width: 1200,
    height: 800,
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#0f0f11",
      symbolColor: "#ffffff"
    },
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      webviewTag: true,
      additionalArguments: ["--js-flags=--max-old-space-size=256 --expose-gc"]
    }
  });
  import_electron.session.defaultSession.webRequest.onHeadersReceived({ urls: ["*://*/*"] }, (details, callback) => {
    const headers = { ...details.responseHeaders };
    const url = details.url || "";
    for (const key of Object.keys(headers)) {
      const lower = key.toLowerCase();
      if (lower === "x-frame-options" || lower === "content-security-policy") delete headers[key];
    }
    if (url.includes("image.tmdb.org")) {
      headers["cache-control"] = ["public, max-age=604800, immutable"];
      delete headers["pragma"];
      delete headers["expires"];
    }
    callback({ responseHeaders: headers });
  });
  import_electron.session.defaultSession.webRequest.onBeforeRequest({ urls: BLOCKED_HOSTS }, (details, callback) => {
    import_blockStats.default.recordBlockedRequest(details.url);
    callback({ cancel: true });
  });
  import_electron.session.defaultSession.webRequest.onBeforeSendHeaders({ urls: ["*://*/*"] }, (details, callback) => {
    const url = details.url;
    const isMedia = url.includes(".m3u8") || url.includes(".ts") || url.includes(".vtt");
    const originalReferer = details.requestHeaders["Referer"] || details.requestHeaders["referer"] || "";
    const isFromIframe = originalReferer.includes("videasy.to") || originalReferer.includes("vidsrc") || originalReferer.includes("2embed") || originalReferer.includes("anineko.to") || originalReferer.includes("flixcloud.cc") || url.includes("vivibebe.site") || url.includes("flixcloud.cc");
    const isLocalProxy = url.includes("/api/scraper/proxy");
    if (isMedia && !isFromIframe && !isLocalProxy) {
      details.requestHeaders["Referer"] = "https://allmanga.to/";
      details.requestHeaders["Origin"] = "https://allmanga.to";
    }
    callback({ requestHeaders: details.requestHeaders });
  });
  mainWindow.webContents.on("did-attach-webview", (_, wc) => {
    if (!sessionsConfigured) {
      sessionsConfigured = true;
      setupSession(import_electron.session.fromPartition("persist:player"), import_electron.session.fromPartition("persist:trailer"));
    }
    try {
      if (wc.session === import_electron.session.fromPartition("persist:player")) {
        playerWcIds.add(wc.id);
        wc.once("destroyed", () => playerWcIds.delete(wc.id));
      }
    } catch {
    }
    wc.setWindowOpenHandler(() => ({ action: "deny" }));
  });
  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
  } else mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const isDevUrl = VITE_DEV_SERVER_URL && url.startsWith(VITE_DEV_SERVER_URL);
    const isLocalUrl = url.startsWith("file://");
    if (!isDevUrl && !isLocalUrl) {
      console.log("Blocked unauthorized top-frame navigation:", url);
      event.preventDefault();
    }
  });
  mainWindow.webContents.setWindowOpenHandler((details) => {
    try {
      const url = new URL(details.url);
      if ([
        "github.com",
        "discord.gg",
        "discord.com",
        "anilist.co",
        "myanimelist.net"
      ].some((d) => url.hostname.endsWith(d) || url.hostname === d)) import_electron.shell.openExternal(details.url);
      else console.log("Blocked unauthorized popup/ad:", details.url);
    } catch (e) {
      console.error("Failed to parse popup URL", e);
    }
    return { action: "deny" };
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
import_electron.app.whenReady().then(() => {
  try {
    const { autoUpdater } = require("electron-updater");
    autoUpdater.autoDownload = false;
    import_electron.ipcMain.handle("check-updates", async () => {
      try {
        return await autoUpdater.checkForUpdates();
      } catch (e) {
        return { error: e.message };
      }
    });
    import_electron.ipcMain.handle("download-update", async () => {
      try {
        return await autoUpdater.downloadUpdate();
      } catch (e) {
        return { error: e.message };
      }
    });
    import_electron.ipcMain.handle("install-update", () => {
      autoUpdater.quitAndInstall();
    });
    autoUpdater.on("update-available", (info) => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("update-available", info);
    });
    autoUpdater.on("update-not-available", (info) => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("update-not-available", info);
    });
    autoUpdater.on("download-progress", (progressObj) => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("update-progress", progressObj);
    });
    autoUpdater.on("update-downloaded", (info) => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("update-downloaded", info);
    });
    autoUpdater.on("error", (err) => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("update-error", err.message);
    });
    autoUpdater.checkForUpdates().catch(() => {
    });
  } catch (e) {
    try {
      console.error("Failed to configure auto-updater:", e);
    } catch (err) {
    }
  }
  let backendProcess = null;
  try {
    const cp2 = __require("child_process");
    const path2 = __require("path");
    const fs2 = __require("fs");
    let backendPath = path2.join(process.resourcesPath, "app.asar.unpacked/backend/dist/bundle.cjs");
    if (!fs2.existsSync(backendPath)) {
      backendPath = path2.join(__dirname, "../backend/dist/bundle.cjs");
    }
    if (!fs2.existsSync(backendPath)) {
      backendPath = path2.join(process.resourcesPath, "app.asar/backend/dist/bundle.cjs");
    }
    if (fs2.existsSync(backendPath)) {
      try {
        console.log("Starting backend from:", backendPath);
      } catch (e) {
      }
      backendProcess = cp2.fork(backendPath, [], {
        env: { ...process.env, VERCEL: "false", ELECTRON_RUN_AS_NODE: "1", YORUMI_USER_DATA_DIR: userDataPath },
        stdio: ["ignore", "pipe", "pipe", "ipc"]
      });
      backendProcess.stdout.on("data", (data) => {
        try {
          console.log(`Backend: ${data}`);
        } catch (e) {
        }
      });
      backendProcess.stderr.on("data", (data) => {
        try {
          console.error(`Backend Error: ${data}`);
        } catch (e) {
        }
      });
      backendProcess.on("error", (err) => {
        try {
          console.error("Backend process error:", err);
        } catch (e) {
        }
      });
      backendProcess.on("exit", (code, signal) => {
        try {
          console.log(`Backend exited with code ${code} and signal ${signal}`);
        } catch (e) {
        }
      });
    } else {
      try {
        console.error("Backend not found at:", backendPath);
      } catch (e) {
      }
    }
  } catch (e) {
    try {
      console.error("Failed to start backend", e);
    } catch (err) {
    }
  }
  const cleanupBackend = () => {
    if (backendProcess) {
      try {
        backendProcess.kill("SIGTERM");
      } catch (e) {
      }
      backendProcess = null;
    }
  };
  import_electron.app.on("before-quit", cleanupBackend);
  import_electron.app.on("will-quit", cleanupBackend);
  createWindow();
  import_electron.app.on("activate", () => {
    if (import_electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
import_electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") import_electron.app.quit();
});
import_electron.ipcMain.handle("get-env", () => {
  return fs.readFileSync(envPath, "utf-8");
});
import_electron.ipcMain.handle("save-env", (_, newEnvContent) => {
  fs.writeFileSync(envPath, newEnvContent, "utf-8");
  return true;
});
var cp = __require("child_process");
var downloadsDir = () => path.join(import_electron.app.getPath("userData"), "downloads");
var downloadsManifestFile = () => path.join(downloadsDir(), "manifest.json");
function sanitizeFolderName(name) {
  return String(name || "Unknown").replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, " ").trim();
}
function organizeLegacyDownloads() {
  try {
    const dir = downloadsDir();
    if (!fs.existsSync(dir)) return;
    const animeDir = path.join(dir, "Anime");
    const mangaDir = path.join(dir, "Manga");
    const lnDir = path.join(dir, "LightNovels");
    if (!fs.existsSync(animeDir)) fs.mkdirSync(animeDir, { recursive: true });
    if (!fs.existsSync(mangaDir)) fs.mkdirSync(mangaDir, { recursive: true });
    if (!fs.existsSync(lnDir)) fs.mkdirSync(lnDir, { recursive: true });
    const manifest = getNativeDownloadsManifest();
    let manifestUpdated = false;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.match(/\.(mp4|ts)$/i) && !entry.name.startsWith("manifest")) {
        const oldPath = path.join(dir, entry.name);
        const keyMatch = entry.name.match(/^(.+?)_ep_(\d+)/i);
        let showTitle = "Unsorted Anime";
        if (keyMatch) {
          const item = manifest.find((m) => m.id?.toLowerCase() === `${keyMatch[1]}_ep_${keyMatch[2]}`.toLowerCase() || m.animeId === keyMatch[1]);
          if (item && item.animeTitle) showTitle = sanitizeFolderName(item.animeTitle);
        }
        const targetSubfolder = path.join(animeDir, showTitle);
        if (!fs.existsSync(targetSubfolder)) fs.mkdirSync(targetSubfolder, { recursive: true });
        const newPath = path.join(targetSubfolder, entry.name);
        try {
          fs.renameSync(oldPath, newPath);
          const item = manifest.find((m) => m.filePath === oldPath);
          if (item) {
            item.filePath = newPath;
            manifestUpdated = true;
          }
        } catch {
        }
      }
    }
    if (manifestUpdated) {
      saveNativeDownloadsManifest(manifest);
    }
  } catch (e) {
    console.warn("Error organizing legacy downloads:", e);
  }
}
var _bootstrapDone = false;
function bootstrapOrphanedDownloads() {
  if (_bootstrapDone) return;
  _bootstrapDone = true;
  try {
    organizeLegacyDownloads();
    const dir = downloadsDir();
    if (!fs.existsSync(dir)) return;
    const existing = getNativeDownloadsManifest();
    const trackedKeys = new Set(existing.map((d) => String(d.id || "").toLowerCase()));
    const trackedPaths = new Set(existing.map((d) => String(d.filePath || "").toLowerCase()));
    const newItems = [];
    const tsToTransmux = [];
    const scanFiles = (targetDir) => {
      if (!fs.existsSync(targetDir)) return;
      const entries = fs.readdirSync(targetDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(targetDir, entry.name);
        if (entry.isDirectory()) {
          scanFiles(fullPath);
        } else if (entry.isFile() && entry.name.match(/\.(ts|mp4)$/i) && !entry.name.startsWith("manifest")) {
          if (trackedPaths.has(fullPath.toLowerCase())) continue;
          const isTs = entry.name.endsWith(".ts");
          if (isTs) {
            const mp4Path = fullPath.replace(/\.ts$/i, ".mp4");
            if (fs.existsSync(mp4Path) && fs.statSync(mp4Path).size > 0) continue;
          } else {
            const tsPath = fullPath.replace(/\.mp4$/i, ".ts");
            if (fs.existsSync(tsPath)) {
              try {
                fs.unlinkSync(tsPath);
              } catch {
              }
            }
          }
          const keyMatch = entry.name.match(/^(.+?)_ep_(\d+)/i);
          if (!keyMatch) continue;
          const animeId = keyMatch[1];
          const episodeNumber = parseInt(keyMatch[2], 10);
          const key = `${animeId}_ep_${episodeNumber}`;
          if (trackedKeys.has(key.toLowerCase())) continue;
          let stat;
          try {
            stat = fs.statSync(fullPath);
          } catch {
            continue;
          }
          const folderName = path.basename(targetDir);
          const inferredTitle = folderName !== "downloads" && folderName !== "Anime" ? folderName : animeId;
          const item = {
            id: key,
            animeId,
            animeTitle: inferredTitle,
            animeImage: "",
            episodeNumber,
            episodeTitle: `Episode ${episodeNumber}`,
            quality: "HD",
            audio: "sub",
            fileSize: stat.size,
            filePath: fullPath,
            isHls: isTs,
            duration: 0,
            downloadedAt: stat.mtimeMs || Date.now()
          };
          newItems.push(item);
          trackedKeys.add(key.toLowerCase());
          trackedPaths.add(fullPath.toLowerCase());
          if (isTs) tsToTransmux.push({ item, tsPath: fullPath });
        }
      }
    };
    scanFiles(dir);
    if (newItems.length > 0) {
      saveNativeDownloadsManifest([...existing, ...newItems]);
    }
    if (tsToTransmux.length > 0) {
      setImmediate(async () => {
        const ffmpeg = findFfmpegExecutable();
        if (!ffmpeg) return;
        for (const { item, tsPath } of tsToTransmux) {
          const mp4Path = tsPath.replace(/\.ts$/i, ".mp4");
          try {
            await new Promise((resolve) => {
              const proc = cp.spawn(ffmpeg, ["-y", "-i", tsPath, "-map", "0:v:0?", "-map", "0:a:0?", "-ignore_unknown", "-c:v", "copy", "-c:a", "aac", "-profile:a", "aac_low", "-b:a", "128k", "-movflags", "+faststart", mp4Path], { windowsHide: true, shell: false });
              proc.on("close", (code) => {
                if (code === 0 && fs.existsSync(mp4Path) && fs.statSync(mp4Path).size > 0) {
                  try {
                    fs.unlinkSync(tsPath);
                  } catch {
                  }
                  const manifest = getNativeDownloadsManifest();
                  const idx = manifest.findIndex((d) => d.id === item.id);
                  if (idx >= 0) {
                    manifest[idx].filePath = mp4Path;
                    manifest[idx].isHls = false;
                    manifest[idx].fileSize = fs.statSync(mp4Path).size;
                    saveNativeDownloadsManifest(manifest);
                  }
                }
                resolve(null);
              });
              proc.on("error", () => resolve(null));
            });
          } catch {
          }
        }
      });
    }
  } catch (e) {
    console.warn("bootstrapOrphanedDownloads error:", e);
  }
}
var _cachedFfmpegBin = void 0;
function findFfmpegExecutable() {
  if (_cachedFfmpegBin !== void 0) return _cachedFfmpegBin;
  const candidates = [
    "ffmpeg",
    path.join(process.env.USERPROFILE || "", "scoop/shims/ffmpeg.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.1-full_build/bin/ffmpeg.exe"),
    "C:/ProgramData/chocolatey/bin/ffmpeg.exe",
    "/usr/local/bin/ffmpeg",
    "/opt/homebrew/bin/ffmpeg",
    "/usr/bin/ffmpeg"
  ];
  for (const c of candidates) {
    try {
      const res = cp.spawnSync(c, ["-version"], { windowsHide: true, shell: false, timeout: 3e3 });
      if (res.status === 0) {
        _cachedFfmpegBin = c;
        return c;
      }
    } catch {
    }
  }
  _cachedFfmpegBin = null;
  return null;
}
function getNativeDownloadsManifest() {
  try {
    if (!fs.existsSync(downloadsDir())) {
      fs.mkdirSync(downloadsDir(), { recursive: true });
    }
    if (!fs.existsSync(downloadsManifestFile())) {
      return [];
    }
    const raw = fs.readFileSync(downloadsManifestFile(), "utf-8");
    return JSON.parse(raw) || [];
  } catch {
    return [];
  }
}
function saveNativeDownloadsManifest(items) {
  try {
    if (!fs.existsSync(downloadsDir())) {
      fs.mkdirSync(downloadsDir(), { recursive: true });
    }
    fs.writeFileSync(downloadsManifestFile(), JSON.stringify(items, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to save downloads manifest:", e);
  }
}
import_electron.ipcMain.handle("get-local-downloads", () => {
  bootstrapOrphanedDownloads();
  return getNativeDownloadsManifest();
});
function cleanDownloadTitle(title) {
  return String(title || "").replace(/\.{2,}|…/g, "").replace(/[^a-zA-Z0-9\s]/g, " ").trim().toLowerCase().replace(/\s+/g, " ");
}
function isDownloadTitleMatch(t1, t2) {
  const c1 = cleanDownloadTitle(t1);
  const c2 = cleanDownloadTitle(t2);
  if (!c1 || !c2) return false;
  if (c1 === c2) return true;
  if (c1.length >= 4 && c2.includes(c1)) return true;
  if (c2.length >= 4 && c1.includes(c2)) return true;
  return false;
}
import_electron.ipcMain.handle("get-local-download", (_, { animeId, episodeNumber, title, anilistId, alternateEpNumbers }) => {
  const items = getNativeDownloadsManifest();
  if (!items || items.length === 0) return null;
  const epNums = [episodeNumber, ...alternateEpNumbers || []].map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0);
  const targetId = String(animeId || "").trim().toLowerCase();
  const anilistStr = anilistId ? String(anilistId).trim().toLowerCase() : "";
  const directKey = `${String(animeId).trim()}_ep_${episodeNumber}`;
  const direct = items.find((d) => (d.id === directKey || epNums.includes(Number(d.episodeNumber)) && String(d.animeId).trim().toLowerCase() === targetId) && (d.filePath ? fs.existsSync(d.filePath) : true));
  if (direct) return direct;
  const match = items.find((d) => {
    if (!epNums.includes(Number(d.episodeNumber))) return false;
    const dAnimeId = String(d.animeId || "").trim().toLowerCase();
    const dKey = String(d.id || "").toLowerCase();
    const idMatch = Boolean(targetId && (dAnimeId === targetId || dAnimeId.includes(targetId) || targetId.includes(dAnimeId) || dKey.startsWith(`${targetId}_ep_`)));
    const anilistMatch = Boolean(anilistStr && (dAnimeId === anilistStr || dKey.startsWith(`${anilistStr}_ep_`)));
    const titleMatch = Boolean(title && isDownloadTitleMatch(d.animeTitle, title));
    return (idMatch || anilistMatch || titleMatch) && (d.filePath ? fs.existsSync(d.filePath) : true);
  });
  return match || null;
});
import_electron.ipcMain.handle("delete-local-download", (_, { animeId, episodeNumber }) => {
  const key = `${String(animeId).trim()}_ep_${episodeNumber}`;
  const items = getNativeDownloadsManifest();
  const item = items.find((d) => d.id === key);
  if (item && item.filePath && fs.existsSync(item.filePath)) {
    try {
      fs.unlinkSync(item.filePath);
    } catch {
    }
  }
  const updated = items.filter((d) => d.id !== key);
  saveNativeDownloadsManifest(updated);
  return true;
});
import_electron.ipcMain.handle("open-downloads-folder", (_, category) => {
  organizeLegacyDownloads();
  let dir = downloadsDir();
  if (category && typeof category === "string") {
    const sub = path.join(dir, category);
    if (!fs.existsSync(sub)) fs.mkdirSync(sub, { recursive: true });
    dir = sub;
  } else {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
  import_electron.shell.openPath(dir);
  return true;
});
import_electron.ipcMain.handle("save-manga-chapter-disk", async (_, { mangaTitle, chapterTitle, pages }) => {
  try {
    const mangaFolder = path.join(downloadsDir(), "Manga", sanitizeFolderName(mangaTitle), sanitizeFolderName(chapterTitle));
    if (!fs.existsSync(mangaFolder)) fs.mkdirSync(mangaFolder, { recursive: true });
    if (Array.isArray(pages)) {
      for (let i = 0; i < pages.length; i++) {
        const p = pages[i];
        if (!p || !p.buffer) continue;
        const pageNumStr = String(p.pageNumber || i + 1).padStart(3, "0");
        const ext = p.ext || ".jpg";
        const filePath = path.join(mangaFolder, `page_${pageNumStr}${ext}`);
        const buf = Buffer.from(p.buffer);
        fs.writeFileSync(filePath, buf);
      }
    }
    return { ok: true, path: mangaFolder };
  } catch (err) {
    console.error("Failed saving manga chapter to disk:", err);
    return { ok: false, error: String(err) };
  }
});
import_electron.ipcMain.handle("save-ln-chapter-disk", async (_, { novelTitle, chapterTitle, content }) => {
  try {
    const lnFolder = path.join(downloadsDir(), "LightNovels", sanitizeFolderName(novelTitle));
    if (!fs.existsSync(lnFolder)) fs.mkdirSync(lnFolder, { recursive: true });
    const filename = `${sanitizeFolderName(chapterTitle)}.txt`;
    const filePath = path.join(lnFolder, filename);
    fs.writeFileSync(filePath, content || "", "utf-8");
    return { ok: true, path: filePath };
  } catch (err) {
    console.error("Failed saving LN chapter to disk:", err);
    return { ok: false, error: String(err) };
  }
});
import_electron.ipcMain.handle("delete-manga-chapter-disk", async (_, { mangaTitle, chapterTitle }) => {
  try {
    const mangaFolder = path.join(downloadsDir(), "Manga", sanitizeFolderName(mangaTitle), sanitizeFolderName(chapterTitle));
    if (fs.existsSync(mangaFolder)) {
      fs.rmSync(mangaFolder, { recursive: true, force: true });
    }
    return true;
  } catch {
    return false;
  }
});
import_electron.ipcMain.handle("delete-ln-chapter-disk", async (_, { novelTitle, chapterTitle }) => {
  try {
    const lnFile = path.join(downloadsDir(), "LightNovels", sanitizeFolderName(novelTitle), `${sanitizeFolderName(chapterTitle)}.txt`);
    if (fs.existsSync(lnFile)) {
      fs.unlinkSync(lnFile);
    }
    return true;
  } catch {
    return false;
  }
});
function resolveHlsUrl(baseUrl, relativeOrAbsolute) {
  const trimmed = String(relativeOrAbsolute || "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  if (baseUrl.includes("/api/scraper/proxy?")) {
    try {
      const parsed = new URL(baseUrl, "http://localhost:3001");
      const targetUrl = parsed.searchParams.get("url");
      if (targetUrl) {
        const resolvedTarget = new URL(trimmed, targetUrl).href;
        parsed.searchParams.set("url", resolvedTarget);
        if (baseUrl.startsWith("/")) {
          return `${parsed.pathname}${parsed.search}`;
        }
        return parsed.href;
      }
    } catch {
    }
  }
  try {
    return new URL(trimmed, baseUrl).href;
  } catch {
    return trimmed;
  }
}
import_electron.ipcMain.handle("download-episode-chunked", async (event, params) => {
  const { animeId, animeTitle, animeImage, episodeNumber, episodeTitle, streamUrl, quality, audio, subtitles } = params;
  if (!streamUrl || typeof streamUrl !== "string" || streamUrl.trim() === "") {
    return { error: "No stream URL provided for download" };
  }
  let parsedStreamUrl;
  try {
    parsedStreamUrl = streamUrl.startsWith("/") ? `http://localhost:3001${streamUrl}` : streamUrl;
    new URL(parsedStreamUrl);
  } catch {
    return { error: `Invalid stream URL: ${streamUrl}` };
  }
  const key = `${String(animeId).trim()}_ep_${episodeNumber}`;
  const animeFolder = path.join(downloadsDir(), "Anime", sanitizeFolderName(animeTitle));
  if (!fs.existsSync(animeFolder)) fs.mkdirSync(animeFolder, { recursive: true });
  const targetBase = key.replace(/[^a-zA-Z0-9_-]/g, "_");
  const mp4Path = path.join(animeFolder, `${targetBase}.mp4`);
  const tmpTsPath = path.join(animeFolder, `${targetBase}.tmp.ts`);
  const sendProgress = (progress, receivedBytes, totalBytes, status, error) => {
    try {
      event.sender.send("download-progress", {
        animeId,
        episodeNumber,
        progress,
        status,
        receivedBytes,
        totalBytes,
        error
      });
    } catch {
    }
  };
  const ffmpegBin = findFfmpegExecutable();
  if (ffmpegBin) {
    try {
      sendProgress(1, 0, 0, "downloading");
      let realUrl = streamUrl;
      let refererHeader = "";
      if (realUrl.includes("/api/scraper/proxy?url=")) {
        try {
          const search = new URL(realUrl, "http://localhost:3001").searchParams;
          realUrl = search.get("url") || realUrl;
          refererHeader = search.get("referer") || "";
        } catch {
        }
      }
      let headersStr = "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36\r\n";
      if (refererHeader) {
        headersStr += `Referer: ${refererHeader}\r
`;
      }
      try {
        const u = new URL(realUrl);
        if (u.hostname.includes("flixcloud") || u.hostname.includes("slopnet")) {
          headersStr += "Referer: https://flixcloud.cc/\r\n";
        } else if (u.hostname.includes("vivibebe") || u.hostname.includes("anineko")) {
          headersStr += "Referer: https://anineko.to/\r\n";
        } else if (u.hostname.includes("allmanga") || u.hostname.includes("anitaku")) {
          headersStr += "Referer: https://allmanga.to/\r\n";
        }
      } catch {
      }
      const ffmpegRes = await new Promise((resolve, reject) => {
        const args = [
          "-y",
          "-loglevel",
          "info",
          "-headers",
          headersStr,
          "-i",
          realUrl,
          "-map",
          "0:v:0?",
          "-map",
          "0:a:0?",
          "-ignore_unknown",
          "-c:v",
          "copy",
          "-c:a",
          "aac",
          "-profile:a",
          "aac_low",
          "-b:a",
          "128k",
          "-movflags",
          "+faststart",
          mp4Path
        ];
        let totalDuration = 0;
        let lastProgressAt = Date.now();
        let timedOut = false;
        const proc = cp.spawn(ffmpegBin, args, { windowsHide: true, shell: false });
        const noProgressTimer = setTimeout(() => {
          if (!totalDuration) {
            timedOut = true;
            try {
              proc.kill();
            } catch {
            }
            reject(new Error("FFmpeg timed out \u2014 no duration detected, stream likely requires proxy"));
          }
        }, 2e4);
        proc.stderr.on("data", (data) => {
          const str = data.toString();
          if (!totalDuration) {
            const durMatch = str.match(/Duration:\s*(\d+):(\d+):([\d.]+)/i);
            if (durMatch) {
              totalDuration = parseInt(durMatch[1], 10) * 3600 + parseInt(durMatch[2], 10) * 60 + parseFloat(durMatch[3]);
              clearTimeout(noProgressTimer);
            }
          }
          const timeMatch = str.match(/time=\s*(\d+):(\d+):([\d.]+)/i);
          if (timeMatch && totalDuration > 0) {
            lastProgressAt = Date.now();
            const curSecs = parseInt(timeMatch[1], 10) * 3600 + parseInt(timeMatch[2], 10) * 60 + parseFloat(timeMatch[3]);
            const progress = Math.min(99, Math.round(curSecs / totalDuration * 100));
            let size = 0;
            try {
              size = fs.statSync(mp4Path).size;
            } catch {
            }
            sendProgress(progress, size, 0, "downloading");
          }
        });
        proc.on("close", (code) => {
          clearTimeout(noProgressTimer);
          if (timedOut) return;
          if (code === 0 && fs.existsSync(mp4Path) && fs.statSync(mp4Path).size > 0) {
            let size = 0;
            try {
              size = fs.statSync(mp4Path).size;
            } catch {
            }
            resolve({ totalBytes: size, duration: totalDuration });
          } else {
            reject(new Error(`ffmpeg exited with code ${code}`));
          }
        });
        proc.on("error", (err) => {
          clearTimeout(noProgressTimer);
          reject(err);
        });
      });
      sendProgress(100, ffmpegRes.totalBytes, ffmpegRes.totalBytes, "completed");
      const downloadedItem = {
        id: key,
        animeId: String(animeId),
        animeTitle,
        animeImage,
        episodeNumber: Number(episodeNumber),
        episodeTitle,
        quality: quality || "1080p",
        audio: audio || "sub",
        subtitles: subtitles || [],
        filePath: mp4Path,
        fileSize: ffmpegRes.totalBytes,
        duration: ffmpegRes.duration,
        isHls: false,
        downloadedAt: Date.now()
      };
      const items = getNativeDownloadsManifest().filter((d) => d.id !== key);
      items.push(downloadedItem);
      saveNativeDownloadsManifest(items);
      return downloadedItem;
    } catch (ffmpegErr) {
      console.warn("Direct FFmpeg download failed, falling back to segment downloader with transmux:", ffmpegErr);
    }
  }
  try {
    let totalBytes = 0;
    let duration = 0;
    const isHls = streamUrl.includes(".m3u8") || streamUrl.includes("m3u8");
    const rawChunkPath = isHls ? tmpTsPath : mp4Path;
    const writeStream = fs.createWriteStream(rawChunkPath);
    let finalFilePath = mp4Path;
    if (isHls) {
      let currentUrl = streamUrl;
      let text = "";
      let lines = [];
      let maxRedirects = 5;
      while (maxRedirects-- > 0) {
        const fetchUrl = currentUrl.startsWith("/") ? `http://localhost:3001${currentUrl}` : currentUrl.startsWith("http") && !currentUrl.includes("localhost:3001") ? `http://localhost:3001/api/scraper/proxy?url=${encodeURIComponent(currentUrl)}` : currentUrl;
        const res = await fetch(fetchUrl);
        if (!res.ok) throw new Error(`Failed to fetch HLS playlist (${res.status})`);
        text = await res.text();
        lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
        if (text.includes("#EXT-X-STREAM-INF")) {
          let bestVariant = "";
          let bestBw = -1;
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.startsWith("#EXT-X-STREAM-INF:")) {
              const bwMatch = line.match(/BANDWIDTH=(\d+)/i);
              const bw = bwMatch ? parseInt(bwMatch[1], 10) : 0;
              const nextLine = lines[i + 1];
              if (nextLine && !nextLine.startsWith("#")) {
                if (bw > bestBw) {
                  bestBw = bw;
                  bestVariant = nextLine;
                }
              }
            }
          }
          if (!bestVariant) {
            const fallback = lines.find((l) => !l.startsWith("#"));
            if (fallback) bestVariant = fallback;
          }
          if (bestVariant) {
            currentUrl = resolveHlsUrl(currentUrl, bestVariant);
            continue;
          }
        }
        break;
      }
      lines.forEach((line) => {
        if (line.startsWith("#EXTINF:")) {
          const match = line.match(/#EXTINF:([\d.]+)/);
          if (match && match[1]) duration += parseFloat(match[1]);
        }
      });
      const segmentUrls = lines.filter((l) => !l.startsWith("#")).map((l) => {
        return resolveHlsUrl(currentUrl, l);
      });
      if (segmentUrls.length === 0) {
        throw new Error("No video segments found in resolved HLS playlist");
      }
      const totalSegments = segmentUrls.length;
      let downloadedCount = 0;
      const BATCH_SIZE = 4;
      for (let i = 0; i < totalSegments; i += BATCH_SIZE) {
        const batchIndices = Array.from({ length: Math.min(BATCH_SIZE, totalSegments - i) }, (_, k) => i + k);
        const buffers = await Promise.all(batchIndices.map(async (idx) => {
          const segUrl = segmentUrls[idx];
          const fetchSegUrl = segUrl.startsWith("/") ? `http://localhost:3001${segUrl}` : segUrl.startsWith("http") && !segUrl.includes("localhost:3001") ? `http://localhost:3001/api/scraper/proxy?url=${encodeURIComponent(segUrl)}` : segUrl;
          const sRes = await fetch(fetchSegUrl);
          if (!sRes.ok) throw new Error(`Failed segment ${idx + 1}/${totalSegments}`);
          return Buffer.from(await sRes.arrayBuffer());
        }));
        for (const buf of buffers) {
          writeStream.write(buf);
          downloadedCount++;
          totalBytes += buf.length;
        }
        const progress = Math.min(95, Math.round(downloadedCount / totalSegments * 95));
        sendProgress(progress, totalBytes, totalBytes, "downloading");
      }
      await new Promise((resolve) => writeStream.end(resolve));
      if (ffmpegBin && fs.existsSync(tmpTsPath)) {
        sendProgress(97, totalBytes, totalBytes, "saving");
        try {
          const transmuxOk = await new Promise((resolve) => {
            const proc = cp.spawn(
              ffmpegBin,
              ["-y", "-i", tmpTsPath, "-map", "0:v:0?", "-map", "0:a:0?", "-ignore_unknown", "-c:v", "copy", "-c:a", "aac", "-profile:a", "aac_low", "-b:a", "128k", "-movflags", "+faststart", mp4Path],
              { windowsHide: true, shell: false }
            );
            proc.on("close", (code) => {
              resolve(code === 0 && fs.existsSync(mp4Path) && fs.statSync(mp4Path).size > 0);
            });
            proc.on("error", () => resolve(false));
          });
          if (transmuxOk) {
            try {
              fs.unlinkSync(tmpTsPath);
            } catch {
            }
            totalBytes = fs.statSync(mp4Path).size;
            finalFilePath = mp4Path;
          } else {
            const tsFallback = path.join(animeFolder, `${targetBase}.ts`);
            try {
              fs.renameSync(tmpTsPath, tsFallback);
            } catch {
            }
            finalFilePath = tsFallback;
          }
        } catch {
          const tsFallback = path.join(animeFolder, `${targetBase}.ts`);
          try {
            fs.renameSync(tmpTsPath, tsFallback);
          } catch {
          }
          finalFilePath = tsFallback;
        }
      } else if (fs.existsSync(tmpTsPath)) {
        const tsFallback = path.join(animeFolder, `${targetBase}.ts`);
        try {
          fs.renameSync(tmpTsPath, tsFallback);
        } catch {
        }
        finalFilePath = tsFallback;
      }
    } else {
      const res = await fetch(streamUrl);
      if (!res.ok) throw new Error(`Failed to fetch video: ${res.status}`);
      const contentLength = res.headers.get("content-length");
      const expectedBytes = contentLength ? parseInt(contentLength, 10) : 0;
      if (res.body && typeof res.body.getReader === "function") {
        const reader = res.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            const buf = Buffer.from(value);
            writeStream.write(buf);
            totalBytes += buf.length;
            const progress = expectedBytes > 0 ? Math.min(95, Math.round(totalBytes / expectedBytes * 95)) : 50;
            sendProgress(progress, totalBytes, expectedBytes || totalBytes, "downloading");
          }
        }
      } else {
        const buf = Buffer.from(await res.arrayBuffer());
        writeStream.write(buf);
        totalBytes = buf.length;
      }
      await new Promise((resolve) => writeStream.end(resolve));
      finalFilePath = mp4Path;
    }
    sendProgress(99, totalBytes, totalBytes, "saving");
    const isFinalMp4 = finalFilePath.endsWith(".mp4");
    const item = {
      id: key,
      animeId: String(animeId),
      animeTitle,
      animeImage,
      episodeNumber: Number(episodeNumber),
      episodeTitle,
      quality: quality || "HD",
      audio: audio || "sub",
      fileSize: totalBytes,
      downloadedAt: Date.now(),
      filePath: finalFilePath,
      isHls: !isFinalMp4,
      duration,
      subtitles
    };
    const items = getNativeDownloadsManifest();
    const updated = [item, ...items.filter((d) => d.id !== key)];
    saveNativeDownloadsManifest(updated);
    sendProgress(100, totalBytes, totalBytes, "completed");
    return item;
  } catch (error) {
    sendProgress(0, 0, 0, "error", error.message || "Download failed");
    throw error;
  }
});
import_storage.default.register();
import_downloads.default.register(getMainWindow);
import_allmanga.default.register();
import_player.default.register(getMainWindow, { writeSecretMigration: import_storage.default.writeSecretMigration });
import_blockStats.default.init(getMainWindow);
import_electron.ipcMain.handle("get-block-stats", () => import_blockStats.default.getBlockStats());
import_electron.ipcMain.on("player-stopped", () => {
  for (const id of playerWcIds) try {
    const wc = import_electron.webContents.fromId(id);
    if (wc && !wc.isDestroyed()) {
      try {
        wc.setAudioMuted(true);
      } catch {
      }
      wc.destroy();
    }
  } catch {
  }
  playerWcIds.clear();
  try {
    const ps = import_electron.session.fromPartition("persist:player");
    ps.clearCache().catch(() => {
    });
    ps.clearStorageData({ storages: ["shadercache", "cachestorage"] }).catch(() => {
    });
  } catch {
  }
  if (typeof global.gc === "function") global.gc();
  const mw = mainWindow;
  if (mw && !mw.isDestroyed()) mw.webContents.executeJavaScript("if(typeof gc==='function') gc();").catch(() => {
  });
});
var discordRpcClient = null;
var discordRpcConnected = false;
var currentDiscordClientId = process.env.DISCORD_CLIENT_ID || process.env.VITE_DISCORD_CLIENT_ID || "1532608064174166097";
var lastPresenceData = null;
var lastDiscordLoginAttempt = 0;
function initDiscordRPC(clientId) {
  if (clientId) {
    currentDiscordClientId = clientId;
  }
  if (!currentDiscordClientId) return;
  const now = Date.now();
  if (now - lastDiscordLoginAttempt < 5e3 && !clientId) return;
  lastDiscordLoginAttempt = now;
  try {
    const DiscordRPC = require("discord-rpc");
    if (discordRpcClient) {
      try {
        discordRpcClient.destroy().catch(() => {
        });
      } catch {
      }
      discordRpcClient = null;
      discordRpcConnected = false;
    }
    discordRpcClient = new DiscordRPC.Client({ transport: "ipc" });
    discordRpcClient.on("ready", () => {
      discordRpcConnected = true;
      console.log("[Discord RPC] Connected to Discord as Client ID:", currentDiscordClientId);
      if (lastPresenceData) {
        setDiscordActivity(lastPresenceData);
      }
    });
    discordRpcClient.on("disconnected", () => {
      discordRpcConnected = false;
      console.log("[Discord RPC] Disconnected from Discord");
    });
    discordRpcClient.login({ clientId: currentDiscordClientId }).catch((err) => {
      discordRpcConnected = false;
      console.log("[Discord RPC] Could not connect to Discord:", err.message || err);
    });
  } catch (err) {
    console.log("[Discord RPC] Error initializing discord-rpc:", err.message || err);
  }
}
function setDiscordActivity(presenceData) {
  lastPresenceData = presenceData;
  if (!discordRpcClient || !discordRpcConnected) {
    initDiscordRPC();
    return false;
  }
  try {
    let largeKey = presenceData.largeImageKey || "yorumi";
    if (largeKey.startsWith("http://")) {
      largeKey = largeKey.replace("http://", "https://");
    }
    let smallKey = presenceData.smallImageKey || "yorumi";
    if (smallKey.startsWith("http://")) {
      smallKey = smallKey.replace("http://", "https://");
    }
    const activity = {
      details: presenceData.details || "Yorumi Anime & Manga Streamer",
      state: presenceData.state || void 0,
      largeImageKey: largeKey,
      largeImageText: presenceData.largeImageText || "Yorumi",
      smallImageKey: smallKey,
      smallImageText: presenceData.smallImageText || "Yorumi",
      instance: false
    };
    if (presenceData.startTimestamp) {
      activity.startTimestamp = presenceData.startTimestamp;
    }
    if (presenceData.endTimestamp) {
      activity.endTimestamp = presenceData.endTimestamp;
    }
    discordRpcClient.setActivity(activity).catch((err) => {
      console.log("[Discord RPC] Failed to set activity:", err.message || err);
    });
    return true;
  } catch (err) {
    console.log("[Discord RPC] Error setting activity:", err.message || err);
    return false;
  }
}
function clearDiscordActivity() {
  lastPresenceData = null;
  if (discordRpcClient && discordRpcConnected) {
    try {
      discordRpcClient.clearActivity().catch(() => {
      });
    } catch {
    }
  }
}
import_electron.ipcMain.handle("update-discord-presence", (_event, presenceData) => {
  return setDiscordActivity(presenceData);
});
import_electron.ipcMain.handle("clear-discord-presence", () => {
  clearDiscordActivity();
  return true;
});
import_electron.ipcMain.handle("set-discord-client-id", (_event, clientId) => {
  if (clientId && clientId !== currentDiscordClientId) {
    currentDiscordClientId = clientId;
    initDiscordRPC(clientId);
    return true;
  }
  return false;
});
import_electron.app.whenReady().then(() => {
  initDiscordRPC();
});
