import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  StatusBar,
  Platform,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
  ScrollView,
  PanResponder,
  Animated,
  Modal,
  Linking,
} from "react-native";
import * as ScreenOrientation from "expo-screen-orientation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import { useIPTV } from "@/context/IPTVContext";
import Colors from "@/constants/colors";
import * as Haptics from "expo-haptics";

// ─── Resize Modes ─────────────────────────────────────────────────────────────
const RESIZE_MODES: { mode: ResizeMode; label: string }[] = [
  { mode: ResizeMode.CONTAIN, label: "Fit" },
  { mode: ResizeMode.COVER, label: "Fill" },
  { mode: ResizeMode.STRETCH, label: "Stretch" },
];
const SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
const SUBTITLE_TRACKS = ["Disabled", "English", "Arabic", "French", "Spanish", "Hindi"];
const AUDIO_TRACKS = ["Auto (Default)", "Track 2", "Track 3", "Track 4", "Track 5"];
const SUPPORTED_CODECS = ["AAC", "AC3", "EAC3", "MP3", "DTS (via VLC)", "HE-AAC", "OPUS", "H.264", "H.265/HEVC"];

// ─── Adaptive Buffer System ────────────────────────────────────────────────────
type AdaptiveMode = "low-latency" | "balanced" | "high-stability";
type DecoderMode = "auto" | "software";
type StreamHealth = "good" | "buffering" | "error" | "unknown";
type NetworkSpeed = "fast" | "medium" | "slow" | "unknown";
type ErrorType = "network" | "decoder" | "timeout" | "unknown";

const ADAPTIVE_CONFIG: Record<AdaptiveMode, {
  maxRetries: number;
  retryDelays: number[];
  stallTimeout: number;
  label: string;
  desc: string;
}> = {
  "low-latency": {
    maxRetries: 2,
    retryDelays: [1000, 2000],
    stallTimeout: 8000,
    label: "Low Latency",
    desc: "Fast channel switch, accepts more stalls",
  },
  "balanced": {
    maxRetries: 3,
    retryDelays: [1000, 2000, 3000],
    stallTimeout: 10000,
    label: "Balanced",
    desc: "Best for most networks",
  },
  "high-stability": {
    maxRetries: 5,
    retryDelays: [1500, 3000, 6000, 8000, 10000],
    stallTimeout: 15000,
    label: "High Stability",
    desc: "Stable on slow or congested connections",
  },
};

const ERROR_LABELS: Record<ErrorType, string> = {
  network: "Network Error",
  decoder: "Codec Error",
  timeout: "Timeout",
  unknown: "Stream Error",
};

function categorizeError(msg: string): ErrorType {
  const m = msg.toLowerCase();
  if (m.includes("codec") || m.includes("decoder") || m.includes("audio") ||
      m.includes("format") || m.includes("unsupported") || m.includes("ac3") ||
      m.includes("eac3") || m.includes("dts") || m.includes("hevc")) return "decoder";
  if (m.includes("network") || m.includes("connection") || m.includes("404") ||
      m.includes("403") || m.includes("refused") || m.includes("unreachable") ||
      m.includes("dns") || m.includes("socket")) return "network";
  if (m.includes("timeout") || m.includes("timed out") || m.includes("stalled")) return "timeout";
  return "unknown";
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function PlayerScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const params = useLocalSearchParams<{
    url: string; title: string; logo?: string; type?: string;
    streamId?: string; genre?: string; year?: string; episode?: string;
  }>();
  const { addToHistory, channels, getStreamUrl } = useIPTV();

  // ── Playback State ──────────────────────────────────────────────────────────
  const [status, setStatus] = useState<AVPlaybackStatus | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [resizeModeIdx, setResizeModeIdx] = useState(0);
  const [speedIdx, setSpeedIdx] = useState(2);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showSubMenu, setShowSubMenu] = useState(false);
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [subtitleIdx, setSubtitleIdx] = useState(0);
  const [audioIdx, setAudioIdx] = useState(0);
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectCount, setReconnectCount] = useState(0);
  const [currentUrl, setCurrentUrl] = useState(decodeURIComponent(params.url));
  const [currentTitle, setCurrentTitle] = useState(params.title || "");
  const [currentStreamId, setCurrentStreamId] = useState(params.streamId || "");
  const [zapBanner, setZapBanner] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [decoderMode, setDecoderMode] = useState<DecoderMode>("auto");
  const [audioDelay, setAudioDelay] = useState(0);
  const [isSwitching, setIsSwitching] = useState(false);
  const [audioRetryCount, setAudioRetryCount] = useState(0);
  const [volume, setVolume] = useState(1.0);
  const [brightness, setBrightness] = useState(1.0);
  const [showVolumeOSD, setShowVolumeOSD] = useState(false);
  const [showBrightnessOSD, setShowBrightnessOSD] = useState(false);
  const [seekPreview, setSeekPreview] = useState<{ direction: "fwd" | "bwd"; secs: number } | null>(null);

  // ── Adaptive & Health State ─────────────────────────────────────────────────
  const [adaptiveMode, setAdaptiveMode] = useState<AdaptiveMode>("balanced");
  const [streamHealth, setStreamHealth] = useState<StreamHealth>("unknown");
  const [networkSpeed, setNetworkSpeed] = useState<NetworkSpeed>("unknown");
  const [errorType, setErrorType] = useState<ErrorType | null>(null);
  const [stallCount, setStallCount] = useState(0);
  const [bufferingSeconds, setBufferingSeconds] = useState(0);

  // ── Refs ────────────────────────────────────────────────────────────────────
  const videoRef = useRef<Video>(null);
  const controlsTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const zapTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const audioRecoveryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const osdTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const bufferStallTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const zapAnim = useRef(new Animated.Value(0)).current;
  const controlsAnim = useRef(new Animated.Value(1)).current;

  const playbackStarted = useRef(false);
  const isPausedByUser = useRef(false);
  const currentUrlRef = useRef(decodeURIComponent(params.url));
  const audioRetryCountRef = useRef(0);
  const openInVLCRef = useRef<() => void>(() => {});
  const volumeRef = useRef(1.0);
  const brightnessRef = useRef(1.0);
  const gestureZoneRef = useRef<"left" | "center" | "right" | null>(null);
  const gestureStartValueRef = useRef(0);
  const isLiveRef = useRef(false);
  const switchChannelFnRef = useRef<(d: "next" | "prev") => void>(() => {});
  const seekFnRef = useRef<(d: number) => void>(() => {});
  const togglePlayFnRef = useRef<() => void>(() => {});
  const adaptiveModeRef = useRef<AdaptiveMode>("balanced");
  const bufferingStartRef = useRef<number | null>(null);
  const loadStartTimeRef = useRef<number>(Date.now());
  const stallCountRef = useRef(0);
  const prefetchAbortRef = useRef<AbortController | null>(null);
  const stallReloadRef = useRef<() => void>(() => {});

  // ── Derived Values ──────────────────────────────────────────────────────────
  const isPlaying = status?.isLoaded ? status.isPlaying : false;
  const isLoading = !status?.isLoaded || reconnecting;
  const isMuted = status?.isLoaded ? status.isMuted : false;
  const progress = status?.isLoaded && status.durationMillis ? status.positionMillis / status.durationMillis : 0;
  const positionMs = status?.isLoaded ? status.positionMillis : 0;
  const durationMs = status?.isLoaded ? (status.durationMillis ?? 0) : 0;
  const isLive = params.type === "live" || durationMs === 0;
  const resizeMode = RESIZE_MODES[resizeModeIdx].mode;
  const currentSpeed = SPEEDS[speedIdx];
  const currentChannelIdx = channels.findIndex((c) => c.streamId === currentStreamId);

  // ── Adjacent Channel Cache ──────────────────────────────────────────────────
  const adjacentChannels = useMemo(() => {
    const idx = channels.findIndex((c) => c.streamId === currentStreamId);
    if (idx === -1 || channels.length < 2) return { prev: null, next: null };
    const prevCh = channels[(idx - 1 + channels.length) % channels.length];
    const nextCh = channels[(idx + 1) % channels.length];
    return {
      prev: { name: prevCh.name, url: prevCh.url || getStreamUrl("live", prevCh.streamId, "ts"), streamId: prevCh.streamId },
      next: { name: nextCh.name, url: nextCh.url || getStreamUrl("live", nextCh.streamId, "ts"), streamId: nextCh.streamId },
    };
  }, [channels, currentStreamId, getStreamUrl]);

  // ── Sync refs ───────────────────────────────────────────────────────────────
  useEffect(() => { currentUrlRef.current = currentUrl; }, [currentUrl]);
  useEffect(() => { audioRetryCountRef.current = audioRetryCount; }, [audioRetryCount]);
  useEffect(() => { isLiveRef.current = isLive; }, [isLive]);
  useEffect(() => { adaptiveModeRef.current = adaptiveMode; }, [adaptiveMode]);

  // ── Prefetch adjacent channels (warm TCP connection) ────────────────────────
  useEffect(() => {
    if (Platform.OS === "web" || !isLive || channels.length < 2) return;
    if (prefetchAbortRef.current) prefetchAbortRef.current.abort();
    const ctrl = new AbortController();
    prefetchAbortRef.current = ctrl;
    const warmUrl = async (url: string) => {
      if (!url) return;
      try {
        await fetch(url, { method: "HEAD", signal: ctrl.signal, cache: "no-store" });
      } catch {}
    };
    if (adjacentChannels.next) warmUrl(adjacentChannels.next.url);
    if (adjacentChannels.prev) warmUrl(adjacentChannels.prev.url);
    return () => ctrl.abort();
  }, [adjacentChannels, isLive, channels.length]);

  // ── Buffering stall timer (100ms tick to track buffering duration) ───────────
  useEffect(() => {
    bufferStallTimer.current = setInterval(() => {
      if (bufferingStartRef.current !== null && !isPausedByUser.current) {
        const elapsed = Date.now() - bufferingStartRef.current;
        setBufferingSeconds(Math.floor(elapsed / 1000));
        const timeout = ADAPTIVE_CONFIG[adaptiveModeRef.current].stallTimeout;
        if (elapsed > timeout) {
          bufferingStartRef.current = null;
          stallCountRef.current += 1;
          setStallCount(stallCountRef.current);
          stallReloadRef.current();
        }
      }
    }, 500);
    return () => { if (bufferStallTimer.current) clearInterval(bufferStallTimer.current); };
  }, []);

  // ── Status Update (core: health + buffering + audio recovery) ──────────────
  const handleStatusUpdate = useCallback((newStatus: AVPlaybackStatus) => {
    setStatus(newStatus);

    if (!newStatus.isLoaded) {
      if ((newStatus as any).error) {
        const err = categorizeError((newStatus as any).error);
        setErrorType(err);
        setStreamHealth("error");
      }
      return;
    }

    // Network speed: measure time from load initiation to first frame
    if (newStatus.isPlaying && !playbackStarted.current) {
      playbackStarted.current = true;
      const loadMs = Date.now() - loadStartTimeRef.current;
      const spd: NetworkSpeed = loadMs < 2500 ? "fast" : loadMs < 6000 ? "medium" : "slow";
      setNetworkSpeed(spd);
      // Auto-adjust buffer mode to match detected speed (only once, unless user overrides)
      if (spd === "slow" && adaptiveModeRef.current === "balanced") {
        setAdaptiveMode("high-stability");
        adaptiveModeRef.current = "high-stability";
      } else if (spd === "fast" && adaptiveModeRef.current === "balanced") {
        setAdaptiveMode("low-latency");
        adaptiveModeRef.current = "low-latency";
      }
      setStreamHealth("good");
      setErrorType(null);
      bufferingStartRef.current = null;
      setBufferingSeconds(0);

      // Audio recovery: 3s after playback starts, check if still playing
      if (audioRecoveryTimer.current) clearTimeout(audioRecoveryTimer.current);
      audioRecoveryTimer.current = setTimeout(async () => {
        try {
          const fresh = await videoRef.current?.getStatusAsync();
          if (!fresh?.isLoaded) return;
          if (!fresh.isPlaying && !isPausedByUser.current) {
            const retries = audioRetryCountRef.current;
            if (retries < 2) {
              playbackStarted.current = false;
              setAudioRetryCount((c) => c + 1);
              await videoRef.current?.stopAsync().catch(() => {});
              await videoRef.current?.loadAsync({ uri: currentUrlRef.current }, { shouldPlay: true }).catch(() => {});
            } else {
              Alert.alert(
                "Audio Issue Detected",
                "Stream stalled shortly after starting. This often means an unsupported audio codec.\n\nVLC supports AC3, EAC3, DTS and all IPTV audio formats.",
                [
                  { text: "Open in VLC", onPress: () => openInVLCRef.current() },
                  { text: "Reload", onPress: async () => {
                    playbackStarted.current = false;
                    setAudioRetryCount(0);
                    loadStartTimeRef.current = Date.now();
                    await videoRef.current?.stopAsync().catch(() => {});
                    await videoRef.current?.loadAsync({ uri: currentUrlRef.current }, { shouldPlay: true }).catch(() => {});
                  }},
                  { text: "Dismiss" },
                ]
              );
            }
          }
        } catch {}
      }, 3000);
    }

    // Buffering health tracking
    if (newStatus.isBuffering && !isPausedByUser.current) {
      setStreamHealth("buffering");
      if (bufferingStartRef.current === null) {
        bufferingStartRef.current = Date.now();
      }
    } else if (!newStatus.isBuffering && newStatus.isPlaying) {
      bufferingStartRef.current = null;
      setBufferingSeconds(0);
      setStreamHealth("good");
    }
  }, []);

  // ── Stall auto-reload ────────────────────────────────────────────────────────
  const triggerStallReload = useCallback(async () => {
    if (isPausedByUser.current) return;
    playbackStarted.current = false;
    loadStartTimeRef.current = Date.now();
    bufferingStartRef.current = null;
    setBufferingSeconds(0);
    setReconnecting(true);
    try {
      await videoRef.current?.loadAsync({ uri: currentUrlRef.current }, { shouldPlay: true });
    } catch {}
    setReconnecting(false);
  }, []);

  useEffect(() => { stallReloadRef.current = triggerStallReload; }, [triggerStallReload]);

  // ── Channel zap animation ────────────────────────────────────────────────────
  const showZapBanner = (channelName: string) => {
    setZapBanner(channelName);
    Animated.sequence([
      Animated.timing(zapAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(1800),
      Animated.timing(zapAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setZapBanner(null));
  };

  // ── OSD auto-dismiss ─────────────────────────────────────────────────────────
  const showOSD = () => {
    if (osdTimer.current) clearTimeout(osdTimer.current);
    osdTimer.current = setTimeout(() => {
      setShowVolumeOSD(false);
      setShowBrightnessOSD(false);
    }, 1200);
  };

  // ── Gesture zones: left = brightness, center = seek/channel, right = volume ──
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 5 || Math.abs(g.dy) > 5,
    onPanResponderGrant: (evt) => {
      const x = evt.nativeEvent.locationX;
      const zone = x < width * 0.22 ? "left" : x > width * 0.78 ? "right" : "center";
      gestureZoneRef.current = zone;
      gestureStartValueRef.current = zone === "left" ? brightnessRef.current : volumeRef.current;
    },
    onPanResponderMove: (_, g) => {
      const zone = gestureZoneRef.current;
      if (!zone || zone === "center") return;
      const delta = -(g.dy / (height * 0.6));
      const newVal = Math.max(0, Math.min(1, gestureStartValueRef.current + delta));
      if (zone === "left") {
        setBrightness(newVal);
        brightnessRef.current = newVal;
        setShowBrightnessOSD(true);
      } else {
        setVolume(newVal);
        volumeRef.current = newVal;
        videoRef.current?.setVolumeAsync(newVal).catch(() => {});
        setShowVolumeOSD(true);
      }
      showOSD();
    },
    onPanResponderRelease: (_, g) => {
      const zone = gestureZoneRef.current;
      gestureZoneRef.current = null;
      const absDx = Math.abs(g.dx);
      const absDy = Math.abs(g.dy);
      if (absDx < 10 && absDy < 10) { handleTap(); return; }
      if (zone === "left" || zone === "right") return;
      if (isLiveRef.current && channels.length > 1) {
        if (absDy > 55 && absDx < absDy) {
          g.dy < 0 ? switchChannelFnRef.current("next") : switchChannelFnRef.current("prev");
          return;
        }
        if (absDx > 90 && absDy < absDx) {
          g.dx < 0 ? switchChannelFnRef.current("next") : switchChannelFnRef.current("prev");
          return;
        }
      }
      if (!isLiveRef.current && absDx > 80 && absDy < absDx) {
        seekFnRef.current(g.dx < 0 ? -15 : 15);
      }
    },
  });

  // ── Screen orientation ────────────────────────────────────────────────────────
  useEffect(() => {
    if (Platform.OS !== "web") {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    }
    return () => {
      if (Platform.OS !== "web") ScreenOrientation.unlockAsync();
    };
  }, []);

  // ── Cleanup ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    resetControlsTimer();
    return () => {
      if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      if (zapTimeout.current) clearTimeout(zapTimeout.current);
      if (audioRecoveryTimer.current) clearTimeout(audioRecoveryTimer.current);
      if (osdTimer.current) clearTimeout(osdTimer.current);
      if (bufferStallTimer.current) clearInterval(bufferStallTimer.current);
      prefetchAbortRef.current?.abort();
    };
  }, []);

  // ── Android TV Remote ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!Platform.isTV) return;
    let tvHandler: any;
    try {
      const { TVEventHandler: TVH } = require("react-native");
      tvHandler = new TVH();
      tvHandler.enable(null, (_: any, evt: any) => {
        if (!evt) return;
        resetControlsTimer();
        switch (evt.eventType) {
          case "select": resetControlsTimer(); break;
          case "playPause": togglePlayFnRef.current(); break;
          case "left": isLiveRef.current ? switchChannelFnRef.current("prev") : seekFnRef.current(-10); break;
          case "right": isLiveRef.current ? switchChannelFnRef.current("next") : seekFnRef.current(10); break;
          case "up": if (isLiveRef.current) switchChannelFnRef.current("next"); break;
          case "down": if (isLiveRef.current) switchChannelFnRef.current("prev"); break;
          case "back": router.back(); break;
        }
      });
    } catch {}
    return () => { try { tvHandler?.disable(); } catch {} };
  }, []);

  // ── Controls animation ────────────────────────────────────────────────────────
  const resetControlsTimer = () => {
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    setShowControls(true);
    Animated.timing(controlsAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    controlsTimeout.current = setTimeout(() => {
      Animated.timing(controlsAnim, { toValue: 0, duration: 350, useNativeDriver: true }).start(() => {
        setShowControls(false);
        setShowSpeedMenu(false);
        setShowSubMenu(false);
        setShowAudioMenu(false);
      });
    }, 3000);
  };

  const handleTap = () => resetControlsTimer();

  // ── VLC Fallback ──────────────────────────────────────────────────────────────
  const openInVLC = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const vlcUrl = `vlc://${currentUrlRef.current}`;
    const supported = await Linking.canOpenURL(vlcUrl).catch(() => false);
    if (supported) {
      await Linking.openURL(vlcUrl);
    } else {
      Alert.alert(
        "VLC Not Installed",
        "Install VLC media player from the app store, then try again.\n\nVLC supports AC3, EAC3, DTS and all IPTV audio codecs.",
        [{ text: "OK" }]
      );
    }
  }, []);
  useEffect(() => { openInVLCRef.current = openInVLC; }, [openInVLC]);

  // ── Smart Error Handler ───────────────────────────────────────────────────────
  const handleError = useCallback((error?: string) => {
    const errType = categorizeError(error || "");
    setErrorType(errType);
    setStreamHealth("error");
    const config = ADAPTIVE_CONFIG[adaptiveModeRef.current];

    // Decoder errors → offer VLC immediately on second attempt
    if (errType === "decoder" && reconnectCount >= 1) {
      Alert.alert(
        "Codec Incompatible",
        "This stream uses an audio codec not supported by the built-in player.\n\nVLC handles AC3, EAC3, DTS, and all IPTV codecs.",
        [
          { text: "Open in VLC", onPress: () => openInVLC() },
          { text: "Try Again", onPress: () => {
            setReconnectCount(0);
            setStreamHealth("unknown");
          }},
          { text: "Dismiss" },
        ]
      );
      return;
    }

    if (reconnectCount >= config.maxRetries) {
      Alert.alert(
        ERROR_LABELS[errType],
        errType === "network"
          ? `Stream failed after ${config.maxRetries} retries.\n\nCheck your internet connection or try a different server.`
          : errType === "timeout"
            ? "The stream timed out repeatedly. Your connection may be too slow."
            : `Stream failed after ${config.maxRetries} attempts.\n\nTry opening in VLC for better codec support.`,
        [
          { text: "Open in VLC", onPress: () => openInVLC() },
          { text: "Dismiss" },
        ]
      );
      return;
    }

    // Exponential retry
    const delay = config.retryDelays[Math.min(reconnectCount, config.retryDelays.length - 1)];
    setReconnecting(true);
    reconnectTimeout.current = setTimeout(async () => {
      setReconnecting(false);
      setReconnectCount((c) => c + 1);
      loadStartTimeRef.current = Date.now();
      try {
        await videoRef.current?.loadAsync({ uri: currentUrl }, { shouldPlay: true, rate: currentSpeed });
      } catch {}
    }, delay);
  }, [reconnectCount, currentUrl, currentSpeed, openInVLC]);

  // ── Stream Reload ─────────────────────────────────────────────────────────────
  const reloadStream = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    resetControlsTimer();
    setReconnecting(true);
    setReconnectCount(0);
    setAudioRetryCount(0);
    setStreamHealth("unknown");
    setErrorType(null);
    setBufferingSeconds(0);
    playbackStarted.current = false;
    isPausedByUser.current = false;
    audioRetryCountRef.current = 0;
    bufferingStartRef.current = null;
    loadStartTimeRef.current = Date.now();
    if (audioRecoveryTimer.current) clearTimeout(audioRecoveryTimer.current);
    try {
      await videoRef.current?.stopAsync();
      await videoRef.current?.loadAsync({ uri: currentUrl }, { shouldPlay: true, rate: currentSpeed });
    } catch {}
    setReconnecting(false);
  };

  // ── Playback Controls ─────────────────────────────────────────────────────────
  const toggleMute = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    resetControlsTimer();
    await videoRef.current?.setIsMutedAsync(!isMuted);
  };

  const togglePlay = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    resetControlsTimer();
    if (isPlaying) {
      isPausedByUser.current = true;
      await videoRef.current?.pauseAsync();
    } else {
      isPausedByUser.current = false;
      await videoRef.current?.playAsync();
    }
  };
  useEffect(() => { togglePlayFnRef.current = togglePlay; });

  const seek = async (delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    resetControlsTimer();
    const newPos = Math.max(0, positionMs + delta * 1000);
    await videoRef.current?.setPositionAsync(newPos);
    setSeekPreview({ direction: delta > 0 ? "fwd" : "bwd", secs: Math.abs(delta) });
    setTimeout(() => setSeekPreview(null), 800);
  };
  useEffect(() => { seekFnRef.current = seek; });

  const cycleResizeMode = () => {
    Haptics.selectionAsync();
    resetControlsTimer();
    setResizeModeIdx((i) => (i + 1) % RESIZE_MODES.length);
  };

  const changeSpeed = async (idx: number) => {
    Haptics.selectionAsync();
    setSpeedIdx(idx);
    setShowSpeedMenu(false);
    resetControlsTimer();
    await videoRef.current?.setRateAsync(SPEEDS[idx], true);
  };

  // ── Channel Switching (uses adjacent cache) ───────────────────────────────────
  const switchChannel = useCallback(async (direction: "next" | "prev") => {
    if (channels.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    resetControlsTimer();

    const cached = direction === "next" ? adjacentChannels.next : adjacentChannels.prev;
    let nextUrl: string;
    let nextName: string;
    let nextStreamId: string;

    if (cached) {
      nextUrl = cached.url;
      nextName = cached.name;
      nextStreamId = cached.streamId;
    } else {
      const idx = channels.findIndex((c) => c.streamId === currentStreamId);
      const nextIdx = direction === "next"
        ? (idx + 1) % channels.length
        : (idx - 1 + channels.length) % channels.length;
      const ch = channels[nextIdx];
      nextUrl = ch.url || getStreamUrl("live", ch.streamId, "ts");
      nextName = ch.name;
      nextStreamId = ch.streamId;
    }

    setCurrentTitle(nextName);
    setCurrentStreamId(nextStreamId);
    setCurrentUrl(nextUrl);
    setReconnectCount(0);
    setAudioRetryCount(0);
    setIsSwitching(true);
    setStreamHealth("unknown");
    setErrorType(null);
    setBufferingSeconds(0);
    playbackStarted.current = false;
    isPausedByUser.current = false;
    audioRetryCountRef.current = 0;
    bufferingStartRef.current = null;
    loadStartTimeRef.current = Date.now();
    if (audioRecoveryTimer.current) clearTimeout(audioRecoveryTimer.current);

    showZapBanner(nextName);
    try {
      await videoRef.current?.loadAsync({ uri: nextUrl }, { shouldPlay: true });
    } catch {}
    setIsSwitching(false);
  }, [channels, currentStreamId, getStreamUrl, adjacentChannels]);

  useEffect(() => { switchChannelFnRef.current = switchChannel; }, [switchChannel]);

  // ── Helpers ────────────────────────────────────────────────────────────────────
  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    return h > 0
      ? `${h}:${String(m % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`
      : `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  };

  const handleBack = () => {
    if (progress > 0.01) {
      addToHistory({
        id: currentStreamId || currentUrl,
        type: params.type === "live" ? "channel" : "movie",
        name: currentTitle || "Unknown",
        thumbnail: params.logo || "",
        progress,
        duration: durationMs,
        timestamp: Date.now(),
        url: currentUrl,
      });
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const handlePiP = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Picture-in-Picture",
      "PiP requires a native build.\n\nOn Android TV, press the Home button during playback to activate system PiP.",
      [{ text: "OK" }]
    );
  };

  if (!params.url) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.danger} />
        <Text style={styles.errorText}>No stream URL provided</Text>
        <Pressable style={styles.errorBtn} onPress={() => router.back()}>
          <Text style={{ color: Colors.accent, fontFamily: "Inter_500Medium" }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  // ── Layout Insets ─────────────────────────────────────────────────────────────
  const topPad = Platform.OS === "web" ? 12 : insets.top || 12;
  const bottomPad = Platform.OS === "web" ? 16 : insets.bottom || 16;
  const leftPad = Platform.OS === "web" ? 12 : insets.left || 12;
  const rightPad = Platform.OS === "web" ? 12 : insets.right || 12;

  const volIcon = isMuted || volume === 0 ? "volume-mute" : volume < 0.4 ? "volume-low-outline" : volume < 0.75 ? "volume-medium-outline" : "volume-high-outline";
  const healthColor = streamHealth === "good" ? "#4CAF50" : streamHealth === "buffering" ? "#FFC107" : streamHealth === "error" ? Colors.danger : "rgba(255,255,255,0.3)";
  const networkSpeedLabel: Record<NetworkSpeed, string> = { fast: "Fast", medium: "Medium", slow: "Slow", unknown: "—" };
  const retryConfig = ADAPTIVE_CONFIG[adaptiveMode];

  // ── Render ─────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar hidden />

      <View style={styles.videoWrapper} {...panResponder.panHandlers} testID="player-touch">
        <Video
          ref={videoRef}
          source={{ uri: currentUrl }}
          style={styles.video}
          resizeMode={resizeMode}
          shouldPlay
          useNativeControls={false}
          onPlaybackStatusUpdate={handleStatusUpdate}
          onError={(e) => handleError(e)}
          rate={currentSpeed}
        />

        {/* Brightness overlay */}
        {brightness < 0.98 && Platform.OS !== "web" && (
          <View
            style={[StyleSheet.absoluteFillObject, { backgroundColor: `rgba(0,0,0,${(1 - brightness) * 0.85})` }]}
            pointerEvents="none"
          />
        )}

        {/* Seek flash */}
        {seekPreview && (
          <View style={styles.seekPreview} pointerEvents="none">
            <Ionicons name={seekPreview.direction === "fwd" ? "play-forward" : "play-back"} size={28} color="#fff" />
            <Text style={styles.seekPreviewText}>{seekPreview.direction === "fwd" ? "+" : "-"}{seekPreview.secs}s</Text>
          </View>
        )}

        {/* ── ANIMATED CONTROLS LAYER ── */}
        <Animated.View
          style={[StyleSheet.absoluteFillObject, { opacity: controlsAnim }]}
          pointerEvents={showControls ? "box-none" : "none"}
        >
          <LinearGradient
            colors={["rgba(0,0,0,0.82)", "rgba(0,0,0,0.2)", "transparent"]}
            style={[styles.topGrad, { height: topPad + 90 }]}
          />
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.3)", "rgba(0,0,0,0.92)"]}
            style={[styles.bottomGrad, { height: bottomPad + 130 }]}
          />

          {/* ── TOP BAR ── */}
          <View style={[styles.topBar, { paddingTop: topPad + 6, paddingLeft: leftPad + 4, paddingRight: rightPad + 4 }]}>
            <Pressable style={styles.backBtn} onPress={handleBack} testID="player-back" hasTVPreferredFocus={Platform.isTV}>
              <Ionicons name="chevron-back" size={24} color="#fff" />
            </Pressable>

            <View style={styles.titleBlock}>
              <View style={styles.titleRow}>
                <Text style={styles.titleText} numberOfLines={1}>{currentTitle}</Text>
                <View style={[styles.healthDot, { backgroundColor: healthColor }]} />
              </View>
              {(params.genre || params.year || params.episode) && (
                <Text style={styles.subtitleText} numberOfLines={1}>
                  {[params.year, params.genre, params.episode].filter(Boolean).join("  ·  ")}
                </Text>
              )}
            </View>

            <View style={styles.topRight}>
              {isLive && (
                <View style={styles.liveBadgePill}>
                  <View style={styles.livePulse} />
                  <Text style={styles.livePillText}>LIVE</Text>
                </View>
              )}
              {Platform.OS === "android" && (
                <Pressable style={styles.topBtn} onPress={handlePiP}>
                  <Ionicons name="copy-outline" size={18} color="#fff" />
                </Pressable>
              )}
              <Pressable style={styles.topBtn} onPress={reloadStream} testID="player-reload">
                <Ionicons name="refresh-outline" size={18} color="#fff" />
              </Pressable>
              <Pressable style={styles.topBtn} onPress={() => { setShowSettings(true); resetControlsTimer(); }} testID="player-settings">
                <Ionicons name="settings-outline" size={18} color="#fff" />
              </Pressable>
            </View>
          </View>

          {/* ── CENTER CONTROLS ── */}
          {(isLoading || isSwitching) ? (
            <View style={styles.centerControls}>
              <ActivityIndicator color={Colors.accent} size="large" />
              <Text style={styles.bufferingText}>
                {isSwitching
                  ? `Loading ${currentTitle}...`
                  : reconnecting
                    ? `Reconnecting (${reconnectCount + 1}/${retryConfig.maxRetries})...`
                    : streamHealth === "buffering" && bufferingSeconds > 2
                      ? `Buffering ${bufferingSeconds}s...`
                      : "Loading stream..."}
              </Text>
              {audioRetryCount > 0 && (
                <Text style={styles.audioRetryText}>Audio recovery {audioRetryCount}/2</Text>
              )}
              {errorType && (
                <View style={styles.errorTypeBadge}>
                  <Ionicons
                    name={errorType === "network" ? "wifi-outline" : errorType === "decoder" ? "musical-note-outline" : "timer-outline"}
                    size={12}
                    color={Colors.danger}
                  />
                  <Text style={styles.errorTypeBadgeText}>{ERROR_LABELS[errorType]}</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.centerControls}>
              {isLive && channels.length > 1 ? (
                <>
                  <Pressable style={styles.sideNavBtn} onPress={() => switchChannel("prev")}>
                    <Ionicons name="play-skip-back" size={28} color="rgba(255,255,255,0.9)" />
                    <Text style={styles.sideNavLabel}>Prev</Text>
                  </Pressable>
                  <Pressable style={styles.playBtn} onPress={togglePlay} testID="player-play">
                    <Ionicons name={isPlaying ? "pause" : "play"} size={44} color="#fff" />
                  </Pressable>
                  <Pressable style={styles.sideNavBtn} onPress={() => switchChannel("next")}>
                    <Ionicons name="play-skip-forward" size={28} color="rgba(255,255,255,0.9)" />
                    <Text style={styles.sideNavLabel}>Next</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable style={styles.sideNavBtn} onPress={() => seek(-10)}>
                    <Ionicons name="play-back" size={28} color="rgba(255,255,255,0.9)" />
                    <Text style={styles.sideNavLabel}>10s</Text>
                  </Pressable>
                  <Pressable style={styles.playBtn} onPress={togglePlay} testID="player-play">
                    <Ionicons name={isPlaying ? "pause" : "play"} size={44} color="#fff" />
                  </Pressable>
                  <Pressable style={styles.sideNavBtn} onPress={() => seek(10)}>
                    <Ionicons name="play-forward" size={28} color="rgba(255,255,255,0.9)" />
                    <Text style={styles.sideNavLabel}>10s</Text>
                  </Pressable>
                </>
              )}
            </View>
          )}

          {/* ── BOTTOM BAR ── */}
          <View style={[styles.bottomBar, { paddingBottom: bottomPad + 8, paddingLeft: leftPad + 4, paddingRight: rightPad + 4 }]}>
            {!isLive && (
              <View style={styles.seekRow}>
                <Text style={styles.timeText}>{formatTime(positionMs)}</Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.min(progress * 100, 100)}%` as any }]} />
                  <View style={[styles.progressThumb, { left: `${Math.min(progress * 100, 100)}%` as any }]} />
                </View>
                <Text style={[styles.timeText, { textAlign: "right" }]}>{formatTime(durationMs)}</Text>
              </View>
            )}

            <View style={styles.controlsRow}>
              {isLive && (
                <View style={styles.liveInfo}>
                  <View style={styles.liveBadgeSmall}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveTextSmall}>LIVE</Text>
                  </View>
                  {currentChannelIdx >= 0 && (
                    <Text style={styles.chText}>CH {currentChannelIdx + 1} / {channels.length}</Text>
                  )}
                </View>
              )}

              <View style={{ flex: 1 }} />

              <View style={styles.bufferModeBadge}>
                <View style={[styles.bufferDot, {
                  backgroundColor: adaptiveMode === "low-latency" ? "#FFC107" : adaptiveMode === "high-stability" ? "#4CAF50" : Colors.accent
                }]} />
                <Text style={styles.bufferModeText}>{ADAPTIVE_CONFIG[adaptiveMode].label}</Text>
              </View>

              {!isLive && (
                <Pressable
                  style={styles.ctrlBtn}
                  onPress={() => { setShowSpeedMenu((v) => !v); setShowSubMenu(false); setShowAudioMenu(false); resetControlsTimer(); }}
                >
                  <Text style={styles.ctrlBtnLabel}>{currentSpeed === 1 ? "1×" : `${currentSpeed}×`}</Text>
                </Pressable>
              )}
              <Pressable
                style={styles.ctrlBtn}
                onPress={() => { setShowAudioMenu((v) => !v); setShowSubMenu(false); setShowSpeedMenu(false); resetControlsTimer(); }}
                testID="player-audio"
              >
                <Ionicons name="musical-notes-outline" size={20} color={audioIdx > 0 ? Colors.accent : "#fff"} />
              </Pressable>
              <Pressable
                style={styles.ctrlBtn}
                onPress={() => { setShowSubMenu((v) => !v); setShowSpeedMenu(false); setShowAudioMenu(false); resetControlsTimer(); }}
              >
                <Ionicons name="text-outline" size={20} color={subtitleIdx > 0 ? Colors.accent : "#fff"} />
              </Pressable>
              <Pressable style={styles.ctrlBtn} onPress={cycleResizeMode}>
                <Ionicons
                  name={resizeModeIdx === 0 ? "scan-outline" : resizeModeIdx === 1 ? "expand-outline" : "contract-outline"}
                  size={20}
                  color="#fff"
                />
              </Pressable>
              <Pressable style={styles.ctrlBtn} onPress={toggleMute} testID="player-mute">
                <Ionicons name={volIcon} size={20} color={isMuted ? Colors.danger : "#fff"} />
              </Pressable>
            </View>

            {showSpeedMenu && (
              <TrackMenu
                items={SPEEDS.map((s) => (s === 1 ? "Normal (1×)" : `${s}×`))}
                activeIdx={speedIdx}
                onSelect={(i) => changeSpeed(i)}
                title="Playback Speed"
                anchorRight={rightPad + 4}
                anchorBottom={bottomPad + 60}
              />
            )}
            {showSubMenu && (
              <TrackMenu
                items={SUBTITLE_TRACKS}
                activeIdx={subtitleIdx}
                onSelect={(i) => { setSubtitleIdx(i); setShowSubMenu(false); resetControlsTimer(); }}
                title="Subtitles"
                anchorRight={rightPad + 4}
                anchorBottom={bottomPad + 60}
              />
            )}
            {showAudioMenu && (
              <TrackMenu
                items={AUDIO_TRACKS}
                activeIdx={audioIdx}
                onSelect={(i) => { setAudioIdx(i); setShowAudioMenu(false); resetControlsTimer(); reloadStream(); }}
                title="Audio Track"
                subtitle="Selecting a track reloads the stream"
                anchorRight={rightPad + 4}
                anchorBottom={bottomPad + 60}
              />
            )}
          </View>

          {/* Gesture zone hints */}
          <View style={[styles.zoneHint, { left: 0, top: "40%", bottom: "40%" }]} pointerEvents="none">
            <Ionicons name="sunny-outline" size={12} color="rgba(255,255,255,0.18)" />
            <Text style={styles.zoneHintText}>Brightness</Text>
          </View>
          <View style={[styles.zoneHint, { right: 0, top: "40%", bottom: "40%" }]} pointerEvents="none">
            <Ionicons name="volume-medium-outline" size={12} color="rgba(255,255,255,0.18)" />
            <Text style={styles.zoneHintText}>Volume</Text>
          </View>
        </Animated.View>

        {/* ── ALWAYS-VISIBLE OVERLAYS ── */}
        {zapBanner && (
          <Animated.View style={[styles.zapBanner, { opacity: zapAnim }]} pointerEvents="none">
            <Ionicons name="tv" size={15} color="#fff" />
            <View>
              <Text style={styles.zapText} numberOfLines={1}>{zapBanner}</Text>
              {channels.length > 1 && currentChannelIdx >= 0 && (
                <Text style={styles.zapSubText}>CH {currentChannelIdx + 1} / {channels.length}  ·  swipe to switch</Text>
              )}
            </View>
          </Animated.View>
        )}

        {showVolumeOSD && (
          <View style={[styles.osdPanel, { right: rightPad + 8 }]} pointerEvents="none">
            <Ionicons name={volIcon} size={18} color="#fff" />
            <View style={styles.osdTrack}>
              <View style={[styles.osdFill, { height: `${Math.round(volume * 100)}%` as any }]} />
            </View>
            <Text style={styles.osdValue}>{Math.round(volume * 100)}%</Text>
          </View>
        )}

        {showBrightnessOSD && (
          <View style={[styles.osdPanel, { left: leftPad + 8 }]} pointerEvents="none">
            <Ionicons name="sunny-outline" size={18} color="#fff" />
            <View style={styles.osdTrack}>
              <View style={[styles.osdFill, { height: `${Math.round(brightness * 100)}%` as any }]} />
            </View>
            <Text style={styles.osdValue}>{Math.round(brightness * 100)}%</Text>
          </View>
        )}

        {isMuted && isPlaying && (
          <Pressable style={[styles.muteBanner, { bottom: bottomPad + 70 }]} onPress={toggleMute} testID="player-no-audio-banner">
            <Ionicons name="volume-mute" size={14} color={Colors.danger} />
            <Text style={styles.muteBannerText}>Audio muted — tap to unmute</Text>
          </Pressable>
        )}

        {/* Long-stall banner (separate from controls, always visible when buffering long) */}
        {streamHealth === "buffering" && bufferingSeconds >= 7 && !reconnecting && !isSwitching && (
          <View style={[styles.stallBanner, { bottom: bottomPad + 70 }]} pointerEvents="none">
            <ActivityIndicator size="small" color={Colors.accent} />
            <Text style={styles.stallText}>
              Buffering {bufferingSeconds}s  ·  Auto-reload in {Math.max(0, Math.ceil((retryConfig.stallTimeout - bufferingSeconds * 1000) / 1000))}s
            </Text>
          </View>
        )}
      </View>

      <PlayerSettingsSheet
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        adaptiveMode={adaptiveMode}
        onAdaptiveMode={(m) => { setAdaptiveMode(m); adaptiveModeRef.current = m; }}
        decoderMode={decoderMode}
        onDecoderMode={setDecoderMode}
        audioDelay={audioDelay}
        onAudioDelay={setAudioDelay}
        onOpenInVLC={openInVLC}
        onReload={() => { setShowSettings(false); reloadStream(); }}
        streamUrl={currentUrl}
        streamHealth={streamHealth}
        networkSpeed={networkSpeed}
        stallCount={stallCount}
      />
    </View>
  );
}

// ─── Settings Sheet ────────────────────────────────────────────────────────────
function PlayerSettingsSheet({
  visible, onClose, adaptiveMode, onAdaptiveMode, decoderMode, onDecoderMode,
  audioDelay, onAudioDelay, onOpenInVLC, onReload, streamUrl,
  streamHealth, networkSpeed, stallCount,
}: {
  visible: boolean; onClose: () => void;
  adaptiveMode: AdaptiveMode; onAdaptiveMode: (m: AdaptiveMode) => void;
  decoderMode: DecoderMode; onDecoderMode: (m: DecoderMode) => void;
  audioDelay: number; onAudioDelay: (d: number) => void;
  onOpenInVLC: () => void; onReload: () => void; streamUrl: string;
  streamHealth: StreamHealth; networkSpeed: NetworkSpeed; stallCount: number;
}) {
  const format = streamUrl.split("?")[0].split(".").pop()?.toUpperCase() || "STREAM";
  const healthColor = streamHealth === "good" ? "#4CAF50" : streamHealth === "buffering" ? "#FFC107" : streamHealth === "error" ? Colors.danger : "rgba(255,255,255,0.3)";
  const healthLabel = streamHealth === "good" ? "Playing" : streamHealth === "buffering" ? "Buffering" : streamHealth === "error" ? "Error" : "Unknown";
  const speedColor = networkSpeed === "fast" ? "#4CAF50" : networkSpeed === "medium" ? "#FFC107" : networkSpeed === "slow" ? Colors.danger : "rgba(255,255,255,0.3)";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={st.sheetOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={st.sheet}>
          <View style={st.sheetHandle} />
          <View style={st.sheetHeader}>
            <Ionicons name="settings-outline" size={18} color={Colors.accent} />
            <Text style={st.sheetTitle}>Player Settings</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={20} color={Colors.textMuted} />
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>

            {/* Stream Health Dashboard */}
            <Text style={st.sectionLabel}>STREAM HEALTH</Text>
            <View style={st.healthDash}>
              <View style={st.healthItem}>
                <View style={[st.healthDot, { backgroundColor: healthColor }]} />
                <Text style={st.healthVal}>{healthLabel}</Text>
                <Text style={st.healthKey}>Status</Text>
              </View>
              <View style={st.healthDivider} />
              <View style={st.healthItem}>
                <View style={[st.healthDot, { backgroundColor: speedColor }]} />
                <Text style={st.healthVal}>{networkSpeed === "unknown" ? "—" : networkSpeed.charAt(0).toUpperCase() + networkSpeed.slice(1)}</Text>
                <Text style={st.healthKey}>Network</Text>
              </View>
              <View style={st.healthDivider} />
              <View style={st.healthItem}>
                <Text style={[st.healthVal, stallCount > 0 && { color: "#FFC107" }]}>{stallCount}</Text>
                <Text style={st.healthKey}>Stalls</Text>
              </View>
              <View style={st.healthDivider} />
              <View style={st.healthItem}>
                <Text style={st.healthVal}>{format}</Text>
                <Text style={st.healthKey}>Format</Text>
              </View>
            </View>

            {/* Adaptive Buffer Mode */}
            <Text style={st.sectionLabel}>ADAPTIVE BUFFER MODE</Text>
            <View style={st.modeCards}>
              {(["low-latency", "balanced", "high-stability"] as AdaptiveMode[]).map((m) => {
                const cfg = ADAPTIVE_CONFIG[m];
                const isActive = adaptiveMode === m;
                const modeColor = m === "low-latency" ? "#FFC107" : m === "high-stability" ? "#4CAF50" : Colors.accent;
                return (
                  <Pressable
                    key={m}
                    style={[st.modeCard, isActive && { borderColor: modeColor, backgroundColor: modeColor + "18" }]}
                    onPress={() => onAdaptiveMode(m)}
                  >
                    <View style={[st.modeDot, { backgroundColor: modeColor }]} />
                    <Text style={[st.modeLabel, isActive && { color: modeColor }]}>{cfg.label}</Text>
                    <Text style={st.modeDesc}>{cfg.desc}</Text>
                    <Text style={st.modeRetry}>
                      {cfg.maxRetries} retries  ·  {cfg.retryDelays.join("/")}ms
                    </Text>
                    {isActive && <View style={[st.modeCheck, { backgroundColor: modeColor }]}>
                      <Ionicons name="checkmark" size={10} color="#000" />
                    </View>}
                  </Pressable>
                );
              })}
            </View>
            <Text style={st.hint}>Network: {networkSpeed} → auto-selected "{ADAPTIVE_CONFIG[adaptiveMode].label}"</Text>

            {/* Player Engine */}
            <Text style={st.sectionLabel}>PLAYER ENGINE</Text>
            <View style={st.row}>
              <View style={[st.engineCard, st.engineCardActive]}>
                <Ionicons name="play-circle" size={22} color={Colors.accent} />
                <Text style={st.engineLabel}>Built-in</Text>
                <Text style={st.engineSub}>ExoPlayer (Android){"\n"}AVPlayer (iOS)</Text>
                <View style={st.activeDot} />
              </View>
              <Pressable style={st.engineCard} onPress={onOpenInVLC}>
                <Ionicons name="open-outline" size={22} color="#fff" />
                <Text style={st.engineLabel}>Open in VLC</Text>
                <Text style={st.engineSub}>AC3 · EAC3 · DTS{"\n"}All codecs supported</Text>
              </Pressable>
            </View>

            {/* Decoder Mode */}
            <Text style={st.sectionLabel}>DECODER MODE</Text>
            <View style={st.toggleRow}>
              {(["auto", "software"] as DecoderMode[]).map((m) => (
                <Pressable key={m} style={[st.toggleBtn, decoderMode === m && st.toggleBtnActive]} onPress={() => onDecoderMode(m)}>
                  <Text style={[st.toggleBtnText, decoderMode === m && st.toggleBtnTextActive]}>
                    {m === "auto" ? "Auto (Hardware)" : "Software"}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={st.hint}>Software decoder fixes AC3/EAC3 audio on some devices · reload to apply</Text>

            {/* Audio Delay */}
            <Text style={st.sectionLabel}>AUDIO DELAY</Text>
            <View style={st.delayRow}>
              <Pressable style={st.delayBtn} onPress={() => onAudioDelay(Math.max(-2000, audioDelay - 100))}>
                <Ionicons name="remove" size={20} color="#fff" />
              </Pressable>
              <View style={st.delayDisplay}>
                <Text style={st.delayValue}>{audioDelay > 0 ? "+" : ""}{audioDelay} ms</Text>
                <Text style={st.delayLabel}>Audio Delay</Text>
              </View>
              <Pressable style={st.delayBtn} onPress={() => onAudioDelay(Math.min(2000, audioDelay + 100))}>
                <Ionicons name="add" size={20} color="#fff" />
              </Pressable>
              {audioDelay !== 0 && (
                <Pressable style={st.delayResetBtn} onPress={() => onAudioDelay(0)}>
                  <Text style={st.delayResetText}>Reset</Text>
                </Pressable>
              )}
            </View>

            {/* Supported Codecs */}
            <Text style={st.sectionLabel}>SUPPORTED CODECS</Text>
            <View style={st.codecGrid}>
              {SUPPORTED_CODECS.map((c) => (
                <View key={c} style={st.codecChip}>
                  <Text style={st.codecText}>{c}</Text>
                </View>
              ))}
            </View>

            {/* Actions */}
            <View style={st.actionRow}>
              <Pressable style={st.actionBtn} onPress={onReload}>
                <Ionicons name="refresh-outline" size={16} color="#fff" />
                <Text style={st.actionBtnText}>Reload Stream</Text>
              </Pressable>
              <Pressable style={[st.actionBtn, st.actionBtnVLC]} onPress={onOpenInVLC}>
                <Ionicons name="open-outline" size={16} color="#000" />
                <Text style={[st.actionBtnText, { color: "#000" }]}>Open in VLC</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Track Menu ────────────────────────────────────────────────────────────────
function TrackMenu({ items, activeIdx, onSelect, title, subtitle, anchorRight, anchorBottom }: {
  items: string[]; activeIdx: number; onSelect: (i: number) => void;
  title: string; subtitle?: string; anchorRight: number; anchorBottom: number;
}) {
  return (
    <View style={[styles.trackMenu, { right: anchorRight, bottom: anchorBottom }]}>
      <Text style={styles.trackMenuTitle}>{title}</Text>
      {subtitle && <Text style={styles.trackMenuSubtitle}>{subtitle}</Text>}
      <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
        {items.map((item, i) => (
          <Pressable
            key={item}
            style={[styles.trackMenuItem, i === activeIdx && styles.trackMenuItemActive]}
            onPress={() => onSelect(i)}
          >
            <Ionicons name={i === activeIdx ? "checkmark-circle" : "ellipse-outline"} size={15} color={i === activeIdx ? Colors.accent : Colors.textMuted} />
            <Text style={[styles.trackMenuText, i === activeIdx && styles.trackMenuTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  videoWrapper: { flex: 1, backgroundColor: "#000" },
  video: { flex: 1 },

  seekPreview: {
    position: "absolute", top: "42%", alignSelf: "center",
    alignItems: "center", gap: 4, backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: 14, paddingHorizontal: 20, paddingVertical: 12,
  },
  seekPreviewText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },

  topGrad: { position: "absolute", top: 0, left: 0, right: 0 },
  bottomGrad: { position: "absolute", bottom: 0, left: 0, right: 0 },

  topBar: {
    position: "absolute", top: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", gap: 10, paddingBottom: 12,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: "rgba(0,0,0,0.35)" },
  titleBlock: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  titleText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold", flexShrink: 1 },
  healthDot: { width: 8, height: 8, borderRadius: 4 },
  subtitleText: { color: "rgba(255,255,255,0.6)", fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  topRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveBadgePill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: Colors.danger, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  livePulse: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#fff" },
  livePillText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1.2 },
  topBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: "rgba(0,0,0,0.4)" },

  centerControls: {
    position: "absolute", top: 0, bottom: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 48,
  },
  playBtn: { width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(255,255,255,0.18)", borderWidth: 2, borderColor: "rgba(255,255,255,0.35)", alignItems: "center", justifyContent: "center" },
  sideNavBtn: { alignItems: "center", gap: 5 },
  sideNavLabel: { color: "rgba(255,255,255,0.65)", fontSize: 11, fontFamily: "Inter_500Medium" },
  bufferingText: { color: "rgba(255,255,255,0.85)", fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  audioRetryText: { color: Colors.accent, fontSize: 12, fontFamily: "Inter_400Regular" },
  errorTypeBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,50,50,0.2)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: Colors.danger + "40" },
  errorTypeBadgeText: { color: Colors.danger, fontSize: 11, fontFamily: "Inter_500Medium" },

  bottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, gap: 8, paddingTop: 8 },
  seekRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingBottom: 2 },
  timeText: { color: "rgba(255,255,255,0.85)", fontSize: 12, fontFamily: "Inter_500Medium", minWidth: 48 },
  progressTrack: { flex: 1, height: 4, backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 2, position: "relative", overflow: "visible" },
  progressFill: { height: "100%", backgroundColor: Colors.accent, borderRadius: 2 },
  progressThumb: { position: "absolute", top: -6, marginLeft: -7, width: 16, height: 16, borderRadius: 8, backgroundColor: "#fff" },
  controlsRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  ctrlBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20 },
  ctrlBtnLabel: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },
  liveInfo: { flexDirection: "row", alignItems: "center", gap: 10 },
  liveBadgeSmall: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.danger, borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3 },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#fff" },
  liveTextSmall: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  chText: { color: "rgba(255,255,255,0.6)", fontSize: 12, fontFamily: "Inter_400Regular" },
  bufferModeBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 8 },
  bufferDot: { width: 5, height: 5, borderRadius: 3 },
  bufferModeText: { color: "rgba(255,255,255,0.6)", fontSize: 10, fontFamily: "Inter_500Medium" },

  zoneHint: { position: "absolute", width: 40, alignItems: "center", justifyContent: "center", gap: 3 },
  zoneHintText: { color: "rgba(255,255,255,0.15)", fontSize: 8, fontFamily: "Inter_400Regular", textAlign: "center" },

  zapBanner: {
    position: "absolute", top: "44%", alignSelf: "center",
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "rgba(0,0,0,0.85)", borderRadius: 14, borderWidth: 1, borderColor: Colors.accent + "60",
    paddingHorizontal: 20, paddingVertical: 13, maxWidth: 300,
  },
  zapText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  zapSubText: { color: "rgba(255,255,255,0.5)", fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 3 },

  osdPanel: {
    position: "absolute", top: "25%", bottom: "25%", width: 48,
    alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "rgba(0,0,0,0.65)", borderRadius: 14, paddingVertical: 14,
  },
  osdTrack: { flex: 1, width: 4, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 2, justifyContent: "flex-end", overflow: "hidden" },
  osdFill: { width: "100%", backgroundColor: Colors.accent, borderRadius: 2 },
  osdValue: { color: "rgba(255,255,255,0.8)", fontSize: 10, fontFamily: "Inter_500Medium" },

  muteBanner: {
    position: "absolute", left: 16, right: 16,
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(0,0,0,0.85)", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: Colors.danger + "55",
  },
  muteBannerText: { flex: 1, color: "#fff", fontSize: 12, fontFamily: "Inter_500Medium" },

  stallBanner: {
    position: "absolute", left: 16, right: 16,
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(0,0,0,0.82)", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: Colors.accent + "40",
  },
  stallText: { flex: 1, color: "rgba(255,255,255,0.8)", fontSize: 12, fontFamily: "Inter_400Regular" },

  trackMenu: { position: "absolute", backgroundColor: "rgba(8,8,20,0.97)", borderRadius: 14, borderWidth: 1, borderColor: Colors.cardBorder, minWidth: 200, maxWidth: 260, zIndex: 50, overflow: "hidden" },
  trackMenuTitle: { fontSize: 11, fontFamily: "Inter_700Bold", color: Colors.textMuted, letterSpacing: 1, textTransform: "uppercase", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  trackMenuSubtitle: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textMuted, paddingHorizontal: 16, paddingBottom: 8, paddingTop: 4, borderBottomWidth: 1, borderBottomColor: Colors.border + "50" },
  trackMenuItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border + "70" },
  trackMenuItemActive: { backgroundColor: Colors.accentSoft },
  trackMenuText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  trackMenuTextActive: { color: Colors.accent, fontFamily: "Inter_600SemiBold" },

  errorContainer: { flex: 1, backgroundColor: Colors.bg, alignItems: "center", justifyContent: "center", gap: 16 },
  errorText: { color: Colors.text, fontSize: 16, fontFamily: "Inter_500Medium" },
  errorBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.accent },
});

const st = StyleSheet.create({
  sheetOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: { backgroundColor: "#0B1525", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "90%", paddingBottom: 24, borderTopWidth: 1, borderColor: Colors.cardBorder },
  sheetHandle: { width: 36, height: 4, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 2, alignSelf: "center", marginTop: 10, marginBottom: 4 },
  sheetHeader: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  sheetTitle: { flex: 1, color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  sectionLabel: { color: Colors.textMuted, fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1.2, textTransform: "uppercase", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },

  healthDash: { flexDirection: "row", marginHorizontal: 20, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 14, borderWidth: 1, borderColor: Colors.cardBorder, overflow: "hidden" },
  healthItem: { flex: 1, alignItems: "center", paddingVertical: 14, gap: 4 },
  healthDot: { width: 8, height: 8, borderRadius: 4 },
  healthVal: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  healthKey: { color: Colors.textMuted, fontSize: 9, fontFamily: "Inter_400Regular" },
  healthDivider: { width: 1, backgroundColor: Colors.cardBorder },

  modeCards: { paddingHorizontal: 20, gap: 8 },
  modeCard: { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.cardBorder, gap: 3, position: "relative" },
  modeDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 2 },
  modeLabel: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  modeDesc: { color: Colors.textMuted, fontSize: 11, fontFamily: "Inter_400Regular" },
  modeRetry: { color: Colors.textMuted, fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 2 },
  modeCheck: { position: "absolute", top: 10, right: 10, width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },

  row: { flexDirection: "row", gap: 10, paddingHorizontal: 20 },
  engineCard: { flex: 1, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 12, padding: 14, gap: 4, borderWidth: 1, borderColor: Colors.cardBorder, alignItems: "center" },
  engineCardActive: { borderColor: Colors.accent, backgroundColor: Colors.accentSoft },
  engineLabel: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  engineSub: { color: Colors.textMuted, fontSize: 10, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 15 },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.accent, marginTop: 4 },

  toggleRow: { flexDirection: "row", gap: 8, paddingHorizontal: 20 },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: Colors.cardBorder },
  toggleBtnActive: { backgroundColor: Colors.accentSoft, borderColor: Colors.accent },
  toggleBtnText: { color: Colors.textMuted, fontSize: 11, fontFamily: "Inter_500Medium" },
  toggleBtnTextActive: { color: Colors.accent, fontFamily: "Inter_600SemiBold" },
  hint: { color: Colors.textMuted, fontSize: 10, fontFamily: "Inter_400Regular", paddingHorizontal: 20, paddingTop: 6, lineHeight: 14 },

  delayRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20 },
  delayBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  delayDisplay: { flex: 1, alignItems: "center" },
  delayValue: { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold" },
  delayLabel: { color: Colors.textMuted, fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 2 },
  delayResetBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.08)" },
  delayResetText: { color: Colors.textMuted, fontSize: 11, fontFamily: "Inter_500Medium" },

  codecGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 20, paddingBottom: 4 },
  codecChip: { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: Colors.cardBorder },
  codecText: { color: Colors.textSecondary, fontSize: 11, fontFamily: "Inter_500Medium" },

  actionRow: { flexDirection: "row", gap: 10, paddingHorizontal: 20, paddingTop: 20 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: Colors.cardBorder },
  actionBtnVLC: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  actionBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
