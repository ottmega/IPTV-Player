import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiUrl } from "@/lib/query-client";

const CACHE_KEY = "ottmega_remote_config";
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;

export interface AppConfig {
  logo: string;
  banner: string;
  bannerTitle: string;
  bannerLink: string;
  showBanner: boolean;
  announcement: string;
  themeColor: string;
}

const DEFAULT_CONFIG: AppConfig = {
  logo: "",
  banner: "",
  bannerTitle: "Visit OTTMEGA Website",
  bannerLink: "https://ottmega.in",
  showBanner: false,
  announcement: "",
  themeColor: "#4F8EF7",
};

interface RemoteConfigContextValue {
  config: AppConfig;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

const RemoteConfigContext = createContext<RemoteConfigContextValue>({
  config: DEFAULT_CONFIG,
  isLoading: false,
  refresh: async () => {},
});

export function RemoteConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(false);
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
      }
    } catch {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(cached) });
        } catch {}
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

    timerRef.current = setInterval(fetchConfig, REFRESH_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchConfig]);

  return (
    <RemoteConfigContext.Provider value={{ config, isLoading, refresh: fetchConfig }}>
      {children}
    </RemoteConfigContext.Provider>
  );
}

export function useRemoteConfig(): RemoteConfigContextValue {
  return useContext(RemoteConfigContext);
}
