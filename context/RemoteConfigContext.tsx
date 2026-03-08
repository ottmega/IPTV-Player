import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { getApiUrl } from "@/lib/query-client";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";

const CACHE_KEY = "ottmega_remote_config";
const PUSH_TOKEN_KEY = "ottmega_push_token";
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;

export const APP_VERSION = Constants.expoConfig?.version || "1.0.0";

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

export function isBannerActive(config: AppConfig): boolean {
  if (!config.showBanner || !config.banner) return false;
  const now = new Date();
  if (config.bannerStartDate) {
    const start = new Date(config.bannerStartDate);
    if (now < start) return false;
  }
  if (config.bannerEndDate) {
    const end = new Date(config.bannerEndDate);
    end.setHours(23, 59, 59, 999);
    if (now > end) return false;
  }
  return true;
}

export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => v.replace(/[^0-9.]/g, "").split(".").map(Number);
  const av = parse(a);
  const bv = parse(b);
  for (let i = 0; i < Math.max(av.length, bv.length); i++) {
    const diff = (av[i] || 0) - (bv[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

interface RemoteConfigContextValue {
  config: AppConfig;
  isLoading: boolean;
  needsUpdate: boolean;
  refresh: () => Promise<void>;
}

const RemoteConfigContext = createContext<RemoteConfigContextValue>({
  config: DEFAULT_CONFIG,
  isLoading: false,
  needsUpdate: false,
  refresh: async () => {},
});

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function registerPushToken(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return null;
    const tokenData = await Notifications.getExpoPushTokenAsync();
    return tokenData.data;
  } catch {
    return null;
  }
}

async function sendTokenToServer(token: string): Promise<void> {
  try {
    const base = getApiUrl();
    const url = new URL("/api/push/register", base).toString();
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, platform: Platform.OS, version: APP_VERSION }),
    });
  } catch {}
}

async function trackOpen(): Promise<void> {
  try {
    const base = getApiUrl();
    const url = new URL("/api/analytics/event", base).toString();
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "app_open", platform: Platform.OS, version: APP_VERSION }),
    });
  } catch {}
}

export function RemoteConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(false);
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const baseUrl = getApiUrl();
      const url = new URL("/api/app-config", baseUrl).toString();
      const res = await fetch(url, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        const merged: AppConfig = { ...DEFAULT_CONFIG, ...data };
        setConfig(merged);
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(merged));
        if (merged.forceUpdate && merged.minAppVersion && compareVersions(APP_VERSION, merged.minAppVersion) < 0) {
          setNeedsUpdate(true);
        }
      }
    } catch {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        try { setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(cached) }); } catch {}
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(CACHE_KEY).then((cached) => {
      if (cached) {
        try { setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(cached) }); } catch {}
      }
    });

    fetchConfig();
    trackOpen();

    if (Platform.OS !== "web") {
      registerPushToken().then(async (token) => {
        if (!token) return;
        const stored = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
        if (stored !== token) {
          await sendTokenToServer(token);
          await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
        }
      });
    }

    timerRef.current = setInterval(fetchConfig, REFRESH_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchConfig]);

  return (
    <RemoteConfigContext.Provider value={{ config, isLoading, needsUpdate, refresh: fetchConfig }}>
      {children}
    </RemoteConfigContext.Provider>
  );
}

export function useRemoteConfig(): RemoteConfigContextValue {
  return useContext(RemoteConfigContext);
}
