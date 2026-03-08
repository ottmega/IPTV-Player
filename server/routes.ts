import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import * as fs from "fs";
import * as path from "path";

export interface AppConfig {
  logo: string;
  banner: string;
  bannerTitle: string;
  bannerLink: string;
  showBanner: boolean;
  announcement: string;
  themeColor: string;
}

const CONFIG_PATH = path.resolve(process.cwd(), "server", "app-config.json");

const DEFAULT_CONFIG: AppConfig = {
  logo: "",
  banner: "",
  bannerTitle: "Visit OTTMEGA Website",
  bannerLink: "https://ottmega.in",
  showBanner: false,
  announcement: "",
  themeColor: "#4F8EF7",
};

function loadConfig(): AppConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
      return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    }
  } catch {
    console.error("Failed to load app config, using defaults");
  }
  return { ...DEFAULT_CONFIG };
}

function saveConfig(config: AppConfig): void {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to save app config:", e);
  }
}

let currentConfig: AppConfig = loadConfig();

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

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/app-config", (_req: Request, res: Response) => {
    res.json(currentConfig);
  });

  app.post("/api/app-config", (req: Request, res: Response) => {
    if (!requireAdminKey(req, res)) return;

    const { logo, banner, bannerTitle, bannerLink, showBanner, announcement, themeColor } = req.body;

    currentConfig = {
      logo: typeof logo === "string" ? logo.trim() : currentConfig.logo,
      banner: typeof banner === "string" ? banner.trim() : currentConfig.banner,
      bannerTitle: typeof bannerTitle === "string" ? bannerTitle.trim() : currentConfig.bannerTitle,
      bannerLink: typeof bannerLink === "string" ? bannerLink.trim() : currentConfig.bannerLink,
      showBanner: typeof showBanner === "boolean" ? showBanner : currentConfig.showBanner,
      announcement: typeof announcement === "string" ? announcement.trim() : currentConfig.announcement,
      themeColor: typeof themeColor === "string" && themeColor.match(/^#[0-9a-fA-F]{6}$/) ? themeColor : currentConfig.themeColor,
    };

    saveConfig(currentConfig);
    res.json({ success: true, config: currentConfig });
  });

  app.get("/api/admin/verify", (req: Request, res: Response) => {
    const key = req.query?.key;
    if (key !== getAdminKey()) {
      return res.json({ valid: false });
    }
    res.json({ valid: true });
  });

  app.get("/admin", (_req: Request, res: Response) => {
    const adminTemplatePath = path.resolve(process.cwd(), "server", "templates", "admin.html");
    if (!fs.existsSync(adminTemplatePath)) {
      return res.status(404).send("Admin panel not found");
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(fs.readFileSync(adminTemplatePath, "utf-8"));
  });

  const httpServer = createServer(app);
  return httpServer;
}
