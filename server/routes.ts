import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";

export interface AppConfig {
  logo: string;
  banner: string;
  bannerTitle: string;
  bannerLink: string;
  showBanner: boolean;
  bannerStartDate: string;
  bannerEndDate: string;
  announcement: string;
  themeColor: string;
  minAppVersion: string;
  updateUrl: string;
  forceUpdate: boolean;
}

const CONFIG_PATH = path.resolve(process.cwd(), "server", "app-config.json");
const ANALYTICS_PATH = path.resolve(process.cwd(), "server", "analytics.json");
const TOKENS_PATH = path.resolve(process.cwd(), "server", "push-tokens.json");

interface AnalyticsData {
  totalOpens: number;
  uniqueDevices: number;
  platforms: Record<string, number>;
  versions: Record<string, number>;
  recentEvents: Array<{ type: string; platform: string; version: string; ip: string; ts: string }>;
  deviceIds: string[];
}

interface PushToken {
  token: string;
  platform: string;
  version: string;
  registeredAt: string;
}

const DEFAULT_CONFIG: AppConfig = {
  logo: "",
  banner: "",
  bannerTitle: "Visit OTTMEGA Website",
  bannerLink: "https://ottmega.in",
  showBanner: false,
  bannerStartDate: "",
  bannerEndDate: "",
  announcement: "",
  themeColor: "#4F8EF7",
  minAppVersion: "",
  updateUrl: "",
  forceUpdate: false,
};

const DEFAULT_ANALYTICS: AnalyticsData = {
  totalOpens: 0,
  uniqueDevices: 0,
  platforms: {},
  versions: {},
  recentEvents: [],
  deviceIds: [],
};

function loadJSON<T>(filePath: string, defaultVal: T): T {
  try {
    if (fs.existsSync(filePath)) {
      return { ...defaultVal as any, ...JSON.parse(fs.readFileSync(filePath, "utf-8")) };
    }
  } catch {}
  return defaultVal;
}

function saveJSON(filePath: string, data: unknown): void {
  try { fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8"); } catch {}
}

let currentConfig: AppConfig = loadJSON(CONFIG_PATH, DEFAULT_CONFIG);
let analytics: AnalyticsData = loadJSON(ANALYTICS_PATH, DEFAULT_ANALYTICS);
let pushTokens: PushToken[] = (() => {
  try {
    if (fs.existsSync(TOKENS_PATH)) return JSON.parse(fs.readFileSync(TOKENS_PATH, "utf-8"));
  } catch {}
  return [];
})();

function getAdminKey(): string {
  return process.env.SESSION_SECRET || "ottmega-admin-2024";
}

function requireAdminKey(req: Request, res: Response): boolean {
  const key = req.headers["x-admin-key"] || req.body?.adminKey || req.query?.key;
  if (key !== getAdminKey()) {
    res.status(401).json({ error: "Unauthorized. Invalid admin key." });
    return false;
  }
  return true;
}

function getClientIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string") return fwd.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

function sendExpoPush(tokens: string[], title: string, body: string): Promise<void> {
  return new Promise((resolve) => {
    const payload = JSON.stringify(
      tokens.map((to) => ({ to, title, body, sound: "default" }))
    );
    const opts: https.RequestOptions = {
      hostname: "exp.host",
      path: "/--/api/v2/push/send",
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
    };
    const req = https.request(opts, (res) => {
      res.on("data", () => {});
      res.on("end", () => resolve());
    });
    req.on("error", () => resolve());
    req.write(payload);
    req.end();
  });
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/app-config", (_req: Request, res: Response) => {
    res.json(currentConfig);
  });

  app.post("/api/app-config", (req: Request, res: Response) => {
    if (!requireAdminKey(req, res)) return;

    const b = req.body;
    currentConfig = {
      logo: typeof b.logo === "string" ? b.logo.trim() : currentConfig.logo,
      banner: typeof b.banner === "string" ? b.banner.trim() : currentConfig.banner,
      bannerTitle: typeof b.bannerTitle === "string" ? b.bannerTitle.trim() : currentConfig.bannerTitle,
      bannerLink: typeof b.bannerLink === "string" ? b.bannerLink.trim() : currentConfig.bannerLink,
      showBanner: typeof b.showBanner === "boolean" ? b.showBanner : currentConfig.showBanner,
      bannerStartDate: typeof b.bannerStartDate === "string" ? b.bannerStartDate.trim() : currentConfig.bannerStartDate,
      bannerEndDate: typeof b.bannerEndDate === "string" ? b.bannerEndDate.trim() : currentConfig.bannerEndDate,
      announcement: typeof b.announcement === "string" ? b.announcement.trim() : currentConfig.announcement,
      themeColor: typeof b.themeColor === "string" && /^#[0-9a-fA-F]{6}$/.test(b.themeColor) ? b.themeColor : currentConfig.themeColor,
      minAppVersion: typeof b.minAppVersion === "string" ? b.minAppVersion.trim() : currentConfig.minAppVersion,
      updateUrl: typeof b.updateUrl === "string" ? b.updateUrl.trim() : currentConfig.updateUrl,
      forceUpdate: typeof b.forceUpdate === "boolean" ? b.forceUpdate : currentConfig.forceUpdate,
    };

    saveJSON(CONFIG_PATH, currentConfig);
    res.json({ success: true, config: currentConfig });
  });

  app.get("/api/admin/verify", (req: Request, res: Response) => {
    const key = req.query?.key;
    res.json({ valid: key === getAdminKey() });
  });

  app.post("/api/analytics/event", (req: Request, res: Response) => {
    const { type = "app_open", platform = "unknown", version = "unknown" } = req.body || {};
    const ip = getClientIp(req);
    const deviceId = ip + "_" + platform;

    analytics.totalOpens = (analytics.totalOpens || 0) + 1;
    analytics.platforms[platform] = (analytics.platforms[platform] || 0) + 1;
    analytics.versions[version] = (analytics.versions[version] || 0) + 1;

    if (!analytics.deviceIds) analytics.deviceIds = [];
    if (!analytics.deviceIds.includes(deviceId)) {
      analytics.deviceIds.push(deviceId);
      analytics.uniqueDevices = analytics.deviceIds.length;
    }

    if (!analytics.recentEvents) analytics.recentEvents = [];
    analytics.recentEvents.unshift({ type, platform, version, ip, ts: new Date().toISOString() });
    if (analytics.recentEvents.length > 50) analytics.recentEvents = analytics.recentEvents.slice(0, 50);

    saveJSON(ANALYTICS_PATH, analytics);
    res.json({ ok: true });
  });

  app.get("/api/analytics", (req: Request, res: Response) => {
    if (!requireAdminKey(req, res)) return;
    const { deviceIds: _d, ...safe } = analytics as any;
    res.json({ ...safe, uniqueDevices: analytics.uniqueDevices || 0 });
  });

  app.post("/api/push/register", (req: Request, res: Response) => {
    const { token, platform, version } = req.body || {};
    if (!token || typeof token !== "string") return res.json({ ok: false, error: "Missing token" });

    const existing = pushTokens.findIndex((t) => t.token === token);
    const entry: PushToken = { token, platform: platform || "unknown", version: version || "unknown", registeredAt: new Date().toISOString() };

    if (existing >= 0) pushTokens[existing] = entry;
    else pushTokens.push(entry);

    saveJSON(TOKENS_PATH, pushTokens);
    res.json({ ok: true });
  });

  app.post("/api/push/send", async (req: Request, res: Response) => {
    if (!requireAdminKey(req, res)) return;
    const { title, body } = req.body || {};
    if (!title || !body) return res.status(400).json({ error: "title and body required" });

    const tokens = pushTokens.map((t) => t.token).filter((t) => t.startsWith("ExponentPushToken"));
    if (tokens.length === 0) return res.json({ ok: true, sent: 0, message: "No registered devices" });

    await sendExpoPush(tokens, title, body);
    res.json({ ok: true, sent: tokens.length });
  });

  app.get("/api/push/stats", (req: Request, res: Response) => {
    if (!requireAdminKey(req, res)) return;
    const byPlatform: Record<string, number> = {};
    pushTokens.forEach((t) => { byPlatform[t.platform] = (byPlatform[t.platform] || 0) + 1; });
    res.json({ total: pushTokens.length, byPlatform, recent: pushTokens.slice(-5).reverse() });
  });

  app.get("/admin", (_req: Request, res: Response) => {
    const p = path.resolve(process.cwd(), "server", "templates", "admin.html");
    if (!fs.existsSync(p)) return res.status(404).send("Admin panel not found");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(fs.readFileSync(p, "utf-8"));
  });

  const httpServer = createServer(app);
  return httpServer;
}
