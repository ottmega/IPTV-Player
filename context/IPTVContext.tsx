import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type LoginType = "xtream" | "m3u" | "stalker";
export type ContentSection = "live" | "vod" | "series" | "guide";
export type ContentStatus = "waiting" | "loading" | "done" | "error";

export interface XtreamCredentials {
  serverUrl: string;
  username: string;
  password: string;
}

export interface M3UCredentials {
  playlistUrl: string;
}

export interface StalkerCredentials {
  portalUrl: string;
  macAddress: string;
}

export type Credentials = XtreamCredentials | M3UCredentials | StalkerCredentials;

export interface Channel {
  streamId: string;
  name: string;
  streamIcon: string;
  categoryId: string;
  url?: string;
  epgChannelId?: string;
  tvArchive?: number;
  quality?: string;
}

export interface Movie {
  streamId: string;
  name: string;
  streamIcon: string;
  categoryId: string;
  rating?: string;
  year?: string;
  genre?: string;
  plot?: string;
  duration?: string;
  url?: string;
}

export interface SeriesItem {
  seriesId: string;
  name: string;
  cover: string;
  categoryId: string;
  rating?: string;
  year?: string;
  genre?: string;
  plot?: string;
}

export interface Episode {
  id: string;
  title: string;
  episodeNum: number;
  season: number;
  containerExtension: string;
  url?: string;
  info?: {
    duration?: string;
    plot?: string;
    cover?: string;
    releaseDate?: string;
    rating?: string;
  };
}

export interface Season {
  seasonNumber: number;
  episodes: Episode[];
  cover?: string;
  airDate?: string;
}

export interface Category {
  categoryId: string;
  categoryName: string;
}

export interface WatchHistoryItem {
  id: string;
  type: "channel" | "movie" | "episode";
  name: string;
  thumbnail: string;
  seriesName?: string;
  progress?: number;
  duration?: number;
  timestamp: number;
  url?: string;
}

export interface EPGItem {
  start: string;
  end: string;
  title: string;
  description?: string;
  channelId: string;
}

export interface SavedAccount {
  loginType: LoginType;
  credentials: Credentials;
}

export interface IPTVState {
  loginType: LoginType | null;
  credentials: Credentials | null;
  userInfo: Record<string, string> | null;
  channels: Channel[];
  liveCategories: Category[];
  movies: Movie[];
  movieCategories: Category[];
  series: SeriesItem[];
  seriesCategories: Category[];
  favorites: {
    channels: string[];
    movies: string[];
    series: string[];
  };
  history: WatchHistoryItem[];
  loading: boolean;
  error: string | null;
  initialized: boolean;
  savedAccount: SavedAccount | null;
  pendingLogin: { type: LoginType; credentials: Credentials } | null;
}

interface IPTVContextValue extends IPTVState {
  login: (type: LoginType, creds: Credentials) => Promise<void>;
  setPendingLogin: (data: { type: LoginType; credentials: Credentials }) => void;
  loginWithProgress: (onProgress: (section: ContentSection, status: ContentStatus) => void) => Promise<void>;
  logout: () => void;
  toggleFavorite: (type: "channels" | "movies" | "series", id: string) => void;
  isFavorite: (type: "channels" | "movies" | "series", id: string) => boolean;
  addToHistory: (item: WatchHistoryItem) => void;
  getStreamUrl: (type: "live" | "movie" | "series", id: string, ext?: string) => string;
  getEpgUrl: () => string;
  refreshContent: () => Promise<void>;
  clearHistory: () => void;
}

const IPTVContext = createContext<IPTVContextValue | null>(null);

const STORAGE_KEY = "ottmega_state";
const SAVED_ACCOUNT_KEY = "ottmega_saved_account";
const LAST_REFRESH_KEY = "ottmega_last_refresh";
const AUTO_REFRESH_INTERVAL_MS = 12 * 60 * 60 * 1000;

function parseM3U(text: string): { channels: Channel[]; categories: Category[] } {
  const lines = text.split("\n");
  const channels: Channel[] = [];
  const categoryMap = new Map<string, string>();
  let categoryCounter = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("#EXTINF:")) {
      const nameMatch = line.match(/,(.+)$/);
      const logoMatch = line.match(/tvg-logo="([^"]*)"/);
      const groupMatch = line.match(/group-title="([^"]*)"/);
      const tvgIdMatch = line.match(/tvg-id="([^"]*)"/);

      const name = nameMatch ? nameMatch[1].trim() : "Unknown";
      const logo = logoMatch ? logoMatch[1] : "";
      const group = groupMatch ? groupMatch[1] : "Uncategorized";
      const tvgId = tvgIdMatch ? tvgIdMatch[1] : "";

      if (!categoryMap.has(group)) {
        categoryMap.set(group, String(categoryCounter++));
      }
      const categoryId = categoryMap.get(group)!;

      const urlLine = lines[i + 1]?.trim();
      if (urlLine && !urlLine.startsWith("#")) {
        channels.push({
          streamId: String(channels.length + 1),
          name,
          streamIcon: logo,
          categoryId,
          url: urlLine,
          epgChannelId: tvgId,
        });
        i++;
      }
    }
  }

  const categories: Category[] = Array.from(categoryMap.entries()).map(([name, id]) => ({
    categoryId: id,
    categoryName: name,
  }));

  return { channels, categories };
}

const INITIAL_STATE: IPTVState = {
  loginType: null,
  credentials: null,
  userInfo: null,
  channels: [],
  liveCategories: [],
  movies: [],
  movieCategories: [],
  series: [],
  seriesCategories: [],
  favorites: { channels: [], movies: [], series: [] },
  history: [],
  loading: false,
  error: null,
  initialized: false,
  savedAccount: null,
  pendingLogin: null,
};

export function IPTVProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<IPTVState>(INITIAL_STATE);

  useEffect(() => {
    loadSavedState();
  }, []);

  useEffect(() => {
    if (!state.initialized || !state.loginType || !state.credentials) return;
    const checkAndRefresh = async () => {
      try {
        const lastRefreshRaw = await AsyncStorage.getItem(LAST_REFRESH_KEY);
        const lastRefresh = lastRefreshRaw ? Number(lastRefreshRaw) : 0;
        if (Date.now() - lastRefresh > AUTO_REFRESH_INTERVAL_MS) {
          await AsyncStorage.setItem(LAST_REFRESH_KEY, String(Date.now()));
          await login(state.loginType!, state.credentials!);
        }
      } catch {}
    };
    checkAndRefresh();
    const interval = setInterval(checkAndRefresh, AUTO_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [state.initialized, state.loginType, state.credentials]);

  const loadSavedState = async () => {
    try {
      const [saved, savedAccountRaw] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem(SAVED_ACCOUNT_KEY),
      ]);
      const savedAccount = savedAccountRaw ? (JSON.parse(savedAccountRaw) as SavedAccount) : null;
      if (saved) {
        const parsed = JSON.parse(saved);
        setState((prev) => ({ ...prev, ...parsed, initialized: true, savedAccount }));
      } else {
        setState((prev) => ({ ...prev, initialized: true, savedAccount }));
      }
    } catch {
      setState((prev) => ({ ...prev, initialized: true }));
    }
  };

  const saveState = async (update: Partial<IPTVState>) => {
    try {
      const keys = ["loginType", "credentials", "userInfo", "favorites", "history"];
      const toSave: Record<string, unknown> = {};
      for (const k of keys) {
        if (k in update) toSave[k] = (update as Record<string, unknown>)[k];
      }
      const existing = await AsyncStorage.getItem(STORAGE_KEY);
      const existingParsed = existing ? JSON.parse(existing) : {};
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...existingParsed, ...toSave }));
    } catch {}
  };

  const setPendingLogin = useCallback((data: { type: LoginType; credentials: Credentials }) => {
    setState((prev) => ({ ...prev, pendingLogin: data }));
  }, []);

  const loginWithProgress = useCallback(
    async (onProgress: (section: ContentSection, status: ContentStatus) => void) => {
      const pending = state.pendingLogin;
      if (!pending) throw new Error("No pending login");

      const { type, credentials: creds } = pending;

      try {
        if (type === "xtream") {
          const c = creds as XtreamCredentials;
          const base = `${c.serverUrl}/player_api.php?username=${c.username}&password=${c.password}`;

          let userInfo: Record<string, string> = {};

          onProgress("live", "loading");
          try {
            const [userInfoRes, liveCatRes, liveStreamsRes] = await Promise.allSettled([
              fetch(`${base}&action=get_user_info`).then((r) => r.json()),
              fetch(`${base}&action=get_live_categories`).then((r) => r.json()),
              fetch(`${base}&action=get_live_streams`).then((r) => r.json()),
            ]);
            userInfo = userInfoRes.status === "fulfilled" ? userInfoRes.value?.user_info ?? {} : {};
            const liveCategories: Category[] =
              liveCatRes.status === "fulfilled"
                ? (liveCatRes.value || []).map((c: Record<string, string>) => ({
                    categoryId: c.category_id,
                    categoryName: c.category_name,
                  }))
                : [];
            const channels: Channel[] =
              liveStreamsRes.status === "fulfilled"
                ? (liveStreamsRes.value || []).map((c: Record<string, string>) => ({
                    streamId: String(c.stream_id),
                    name: c.name,
                    streamIcon: c.stream_icon,
                    categoryId: String(c.category_id),
                    epgChannelId: c.epg_channel_id,
                    tvArchive: Number(c.tv_archive ?? 0),
                  }))
                : [];
            setState((prev) => ({ ...prev, liveCategories, channels, userInfo }));
            onProgress("live", "done");
          } catch {
            onProgress("live", "error");
          }

          onProgress("vod", "loading");
          try {
            const [vodCatRes, vodStreamsRes] = await Promise.allSettled([
              fetch(`${base}&action=get_vod_categories`).then((r) => r.json()),
              fetch(`${base}&action=get_vod_streams`).then((r) => r.json()),
            ]);
            const movieCategories: Category[] =
              vodCatRes.status === "fulfilled"
                ? (vodCatRes.value || []).map((c: Record<string, string>) => ({
                    categoryId: c.category_id,
                    categoryName: c.category_name,
                  }))
                : [];
            const movies: Movie[] =
              vodStreamsRes.status === "fulfilled"
                ? (vodStreamsRes.value || []).map((m: Record<string, string>) => ({
                    streamId: String(m.stream_id),
                    name: m.name,
                    streamIcon: m.stream_icon,
                    categoryId: String(m.category_id),
                    rating: m.rating,
                    year: m.year,
                    genre: m.genre,
                    plot: m.plot,
                    duration: m.duration_secs
                      ? String(Math.round(Number(m.duration_secs) / 60)) + " min"
                      : undefined,
                  }))
                : [];
            setState((prev) => ({ ...prev, movieCategories, movies }));
            onProgress("vod", "done");
          } catch {
            onProgress("vod", "error");
          }

          onProgress("series", "loading");
          try {
            const [seriesCatRes, seriesRes] = await Promise.allSettled([
              fetch(`${base}&action=get_series_categories`).then((r) => r.json()),
              fetch(`${base}&action=get_series`).then((r) => r.json()),
            ]);
            const seriesCategories: Category[] =
              seriesCatRes.status === "fulfilled"
                ? (seriesCatRes.value || []).map((c: Record<string, string>) => ({
                    categoryId: c.category_id,
                    categoryName: c.category_name,
                  }))
                : [];
            const series: SeriesItem[] =
              seriesRes.status === "fulfilled"
                ? (seriesRes.value || []).map((s: Record<string, string>) => ({
                    seriesId: String(s.series_id),
                    name: s.name,
                    cover: s.cover,
                    categoryId: String(s.category_id),
                    rating: s.rating,
                    year: s.year,
                    genre: s.genre,
                    plot: s.plot,
                  }))
                : [];
            setState((prev) => ({ ...prev, seriesCategories, series }));
            onProgress("series", "done");
          } catch {
            onProgress("series", "error");
          }

          onProgress("guide", "loading");
          await new Promise((r) => setTimeout(r, 300));
          onProgress("guide", "done");

          const savedAccount: SavedAccount = { loginType: type, credentials: creds };
          await AsyncStorage.setItem(SAVED_ACCOUNT_KEY, JSON.stringify(savedAccount));

          const finalState: Partial<IPTVState> = {
            loginType: type,
            credentials: creds,
            userInfo,
            loading: false,
            error: null,
            savedAccount,
            pendingLogin: null,
          };
          setState((prev) => ({
            ...prev,
            ...finalState,
          }));
          await saveState(finalState);
        } else if (type === "m3u") {
          const c = creds as M3UCredentials;
          onProgress("live", "loading");
          const response = await fetch(c.playlistUrl);
          const text = await response.text();
          const parsed = parseM3U(text);
          setState((prev) => ({
            ...prev,
            channels: parsed.channels,
            liveCategories: parsed.categories,
          }));
          onProgress("live", "done");
          onProgress("vod", "loading");
          await new Promise((r) => setTimeout(r, 200));
          onProgress("vod", "done");
          onProgress("series", "loading");
          await new Promise((r) => setTimeout(r, 200));
          onProgress("series", "done");
          onProgress("guide", "loading");
          await new Promise((r) => setTimeout(r, 200));
          onProgress("guide", "done");

          const userInfo = { username: "M3U User", expDate: "N/A" };
          const savedAccount: SavedAccount = { loginType: type, credentials: creds };
          await AsyncStorage.setItem(SAVED_ACCOUNT_KEY, JSON.stringify(savedAccount));

          const finalState: Partial<IPTVState> = {
            loginType: type,
            credentials: creds,
            userInfo,
            loading: false,
            error: null,
            savedAccount,
            pendingLogin: null,
          };
          setState((prev) => ({ ...prev, ...finalState }));
          await saveState(finalState);
        } else if (type === "stalker") {
          for (const section of ["live", "vod", "series", "guide"] as ContentSection[]) {
            onProgress(section, "loading");
            await new Promise((r) => setTimeout(r, 400));
            onProgress(section, "done");
          }
          const userInfo = { username: "Stalker User", expDate: "N/A" };
          const savedAccount: SavedAccount = { loginType: type, credentials: creds };
          await AsyncStorage.setItem(SAVED_ACCOUNT_KEY, JSON.stringify(savedAccount));
          const finalState: Partial<IPTVState> = {
            loginType: type,
            credentials: creds,
            userInfo,
            loading: false,
            error: null,
            savedAccount,
            pendingLogin: null,
          };
          setState((prev) => ({ ...prev, ...finalState }));
          await saveState(finalState);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Login failed";
        setState((prev) => ({ ...prev, loading: false, error: msg, pendingLogin: null }));
        throw e;
      }
    },
    [state.pendingLogin]
  );

  const login = useCallback(async (type: LoginType, creds: Credentials) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      let userInfo: Record<string, string> = {};
      let channels: Channel[] = [];
      let liveCategories: Category[] = [];
      let movies: Movie[] = [];
      let movieCategories: Category[] = [];
      let series: SeriesItem[] = [];
      let seriesCategories: Category[] = [];

      if (type === "xtream") {
        const c = creds as XtreamCredentials;
        const base = `${c.serverUrl}/player_api.php?username=${c.username}&password=${c.password}`;
        const [uiRes, lcRes, lsRes, vcRes, vsRes, scRes, sRes] = await Promise.allSettled([
          fetch(`${base}&action=get_user_info`).then((r) => r.json()),
          fetch(`${base}&action=get_live_categories`).then((r) => r.json()),
          fetch(`${base}&action=get_live_streams`).then((r) => r.json()),
          fetch(`${base}&action=get_vod_categories`).then((r) => r.json()),
          fetch(`${base}&action=get_vod_streams`).then((r) => r.json()),
          fetch(`${base}&action=get_series_categories`).then((r) => r.json()),
          fetch(`${base}&action=get_series`).then((r) => r.json()),
        ]);
        userInfo = uiRes.status === "fulfilled" ? uiRes.value?.user_info ?? {} : {};
        liveCategories = lcRes.status === "fulfilled"
          ? (lcRes.value || []).map((c: Record<string, string>) => ({ categoryId: c.category_id, categoryName: c.category_name })) : [];
        channels = lsRes.status === "fulfilled"
          ? (lsRes.value || []).map((c: Record<string, string>) => ({ streamId: String(c.stream_id), name: c.name, streamIcon: c.stream_icon, categoryId: String(c.category_id), epgChannelId: c.epg_channel_id, tvArchive: Number(c.tv_archive ?? 0) })) : [];
        movieCategories = vcRes.status === "fulfilled"
          ? (vcRes.value || []).map((c: Record<string, string>) => ({ categoryId: c.category_id, categoryName: c.category_name })) : [];
        movies = vsRes.status === "fulfilled"
          ? (vsRes.value || []).map((m: Record<string, string>) => ({ streamId: String(m.stream_id), name: m.name, streamIcon: m.stream_icon, categoryId: String(m.category_id), rating: m.rating, year: m.year })) : [];
        seriesCategories = scRes.status === "fulfilled"
          ? (scRes.value || []).map((c: Record<string, string>) => ({ categoryId: c.category_id, categoryName: c.category_name })) : [];
        series = sRes.status === "fulfilled"
          ? (sRes.value || []).map((s: Record<string, string>) => ({ seriesId: String(s.series_id), name: s.name, cover: s.cover, categoryId: String(s.category_id), rating: s.rating, year: s.year })) : [];
      } else if (type === "m3u") {
        const c = creds as M3UCredentials;
        const response = await fetch(c.playlistUrl);
        const text = await response.text();
        const parsed = parseM3U(text);
        channels = parsed.channels;
        liveCategories = parsed.categories;
        userInfo = { username: "M3U User", expDate: "N/A" };
      } else if (type === "stalker") {
        userInfo = { username: "Stalker User", expDate: "N/A" };
      }

      const savedAccount: SavedAccount = { loginType: type, credentials: creds };
      await AsyncStorage.setItem(SAVED_ACCOUNT_KEY, JSON.stringify(savedAccount));

      const newState: Partial<IPTVState> = {
        loginType: type, credentials: creds, userInfo, channels, liveCategories,
        movies, movieCategories, series, seriesCategories, loading: false, error: null, savedAccount,
      };
      setState((prev) => ({ ...prev, ...newState }));
      await saveState(newState);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Login failed";
      setState((prev) => ({ ...prev, loading: false, error: msg }));
      throw e;
    }
  }, []);

  const refreshContent = useCallback(async () => {
    if (!state.loginType || !state.credentials) return;
    await login(state.loginType, state.credentials);
    await AsyncStorage.setItem(LAST_REFRESH_KEY, String(Date.now()));
  }, [state.loginType, state.credentials, login]);

  const logout = useCallback(() => {
    setState((prev) => ({
      ...INITIAL_STATE,
      initialized: true,
      savedAccount: prev.savedAccount,
      favorites: prev.favorites,
      history: prev.history,
    }));
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }, []);

  const toggleFavorite = useCallback(
    (type: "channels" | "movies" | "series", id: string) => {
      setState((prev) => {
        const list = prev.favorites[type];
        const updated = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
        const newFavorites = { ...prev.favorites, [type]: updated };
        saveState({ favorites: newFavorites });
        return { ...prev, favorites: newFavorites };
      });
    },
    []
  );

  const isFavorite = useCallback(
    (type: "channels" | "movies" | "series", id: string) => {
      return state.favorites[type].includes(id);
    },
    [state.favorites]
  );

  const addToHistory = useCallback((item: WatchHistoryItem) => {
    setState((prev) => {
      const filtered = prev.history.filter((h) => h.id !== item.id);
      const newHistory = [item, ...filtered].slice(0, 50);
      saveState({ history: newHistory });
      return { ...prev, history: newHistory };
    });
  }, []);

  const clearHistory = useCallback(() => {
    setState((prev) => {
      saveState({ history: [] });
      return { ...prev, history: [] };
    });
  }, []);

  const getStreamUrl = useCallback(
    (type: "live" | "movie" | "series", id: string, ext = "ts") => {
      if (state.loginType === "xtream") {
        const creds = state.credentials as XtreamCredentials;
        if (type === "live") return `${creds.serverUrl}/live/${creds.username}/${creds.password}/${id}.${ext}`;
        if (type === "movie") return `${creds.serverUrl}/movie/${creds.username}/${creds.password}/${id}.${ext}`;
        return `${creds.serverUrl}/series/${creds.username}/${creds.password}/${id}.${ext}`;
      }
      return "";
    },
    [state.loginType, state.credentials]
  );

  const getEpgUrl = useCallback(() => {
    if (state.loginType === "xtream") {
      const creds = state.credentials as XtreamCredentials;
      return `${creds.serverUrl}/xmltv.php?username=${creds.username}&password=${creds.password}`;
    }
    return "";
  }, [state.loginType, state.credentials]);

  const value = useMemo<IPTVContextValue>(
    () => ({
      ...state,
      login,
      setPendingLogin,
      loginWithProgress,
      logout,
      toggleFavorite,
      isFavorite,
      addToHistory,
      getStreamUrl,
      getEpgUrl,
      refreshContent,
      clearHistory,
    }),
    [state, login, setPendingLogin, loginWithProgress, logout, toggleFavorite, isFavorite, addToHistory, getStreamUrl, getEpgUrl, refreshContent, clearHistory]
  );

  return <IPTVContext.Provider value={value}>{children}</IPTVContext.Provider>;
}

export function useIPTV() {
  const ctx = useContext(IPTVContext);
  if (!ctx) throw new Error("useIPTV must be used within IPTVProvider");
  return ctx;
}
