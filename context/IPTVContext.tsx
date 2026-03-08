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
}

interface IPTVContextValue extends IPTVState {
  login: (type: LoginType, creds: Credentials) => Promise<void>;
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

export function IPTVProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<IPTVState>({
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
  });

  useEffect(() => {
    loadSavedState();
  }, []);

  const loadSavedState = async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setState((prev) => ({ ...prev, ...parsed }));
      }
    } catch {}
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

  const fetchXtreamContent = async (creds: XtreamCredentials) => {
    const base = `${creds.serverUrl}/player_api.php?username=${creds.username}&password=${creds.password}`;
    try {
      const [
        userInfoRes,
        liveCatRes,
        liveStreamsRes,
        vodCatRes,
        vodStreamsRes,
        seriesCatRes,
        seriesRes,
      ] = await Promise.allSettled([
        fetch(`${base}&action=get_user_info`).then((r) => r.json()),
        fetch(`${base}&action=get_live_categories`).then((r) => r.json()),
        fetch(`${base}&action=get_live_streams`).then((r) => r.json()),
        fetch(`${base}&action=get_vod_categories`).then((r) => r.json()),
        fetch(`${base}&action=get_vod_streams`).then((r) => r.json()),
        fetch(`${base}&action=get_series_categories`).then((r) => r.json()),
        fetch(`${base}&action=get_series`).then((r) => r.json()),
      ]);

      const userInfo =
        userInfoRes.status === "fulfilled" ? userInfoRes.value?.user_info ?? {} : {};
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

      return { userInfo, liveCategories, channels, movieCategories, movies, seriesCategories, series };
    } catch (e) {
      throw new Error("Failed to fetch content from server");
    }
  };

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
        const data = await fetchXtreamContent(c);
        userInfo = data.userInfo;
        channels = data.channels;
        liveCategories = data.liveCategories;
        movies = data.movies;
        movieCategories = data.movieCategories;
        series = data.series;
        seriesCategories = data.seriesCategories;
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

      const newState: Partial<IPTVState> = {
        loginType: type,
        credentials: creds,
        userInfo,
        channels,
        liveCategories,
        movies,
        movieCategories,
        series,
        seriesCategories,
        loading: false,
        error: null,
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
  }, [state.loginType, state.credentials, login]);

  const logout = useCallback(() => {
    setState({
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
    });
    AsyncStorage.removeItem(STORAGE_KEY);
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
        if (type === "live") {
          return `${creds.serverUrl}/live/${creds.username}/${creds.password}/${id}.${ext}`;
        } else if (type === "movie") {
          return `${creds.serverUrl}/movie/${creds.username}/${creds.password}/${id}.${ext}`;
        } else {
          return `${creds.serverUrl}/series/${creds.username}/${creds.password}/${id}.${ext}`;
        }
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
      logout,
      toggleFavorite,
      isFavorite,
      addToHistory,
      getStreamUrl,
      getEpgUrl,
      refreshContent,
      clearHistory,
    }),
    [state, login, logout, toggleFavorite, isFavorite, addToHistory, getStreamUrl, getEpgUrl, refreshContent, clearHistory]
  );

  return <IPTVContext.Provider value={value}>{children}</IPTVContext.Provider>;
}

export function useIPTV() {
  const ctx = useContext(IPTVContext);
  if (!ctx) throw new Error("useIPTV must be used within IPTVProvider");
  return ctx;
}
