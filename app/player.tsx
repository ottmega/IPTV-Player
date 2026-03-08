import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  StatusBar,
  Dimensions,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import { useIPTV } from "@/context/IPTVContext";
import Colors from "@/constants/colors";
import * as Haptics from "expo-haptics";

const { width, height } = Dimensions.get("window");

const RESIZE_MODES: { mode: ResizeMode; label: string }[] = [
  { mode: ResizeMode.CONTAIN, label: "Fit" },
  { mode: ResizeMode.COVER, label: "Fill" },
  { mode: ResizeMode.STRETCH, label: "Stretch" },
];

const SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

export default function PlayerScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ url: string; title: string; logo?: string; type?: string; streamId?: string }>();
  const { addToHistory } = useIPTV();

  const [status, setStatus] = useState<AVPlaybackStatus | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [resizeModeIdx, setResizeModeIdx] = useState(0);
  const [speedIdx, setSpeedIdx] = useState(2);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectCount, setReconnectCount] = useState(0);

  const videoRef = useRef<Video>(null);
  const controlsTimeout = useRef<ReturnType<typeof setTimeout>>();
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout>>();

  const isPlaying = status?.isLoaded ? status.isPlaying : false;
  const isLoading = !status?.isLoaded || reconnecting;
  const progress = status?.isLoaded && status.durationMillis
    ? status.positionMillis / status.durationMillis
    : 0;
  const positionMs = status?.isLoaded ? status.positionMillis : 0;
  const durationMs = status?.isLoaded ? (status.durationMillis ?? 0) : 0;
  const isLive = params.type === "live" || durationMs === 0;

  const resizeMode = RESIZE_MODES[resizeModeIdx].mode;
  const resizeModeLabel = RESIZE_MODES[resizeModeIdx].label;
  const currentSpeed = SPEEDS[speedIdx];

  useEffect(() => {
    resetControlsTimer();
    return () => {
      if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
    };
  }, []);

  const resetControlsTimer = () => {
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    setShowControls(true);
    controlsTimeout.current = setTimeout(() => {
      setShowControls(false);
      setShowSpeedMenu(false);
    }, 4500);
  };

  const handleTap = () => {
    resetControlsTimer();
  };

  const handleError = useCallback(() => {
    if (reconnectCount >= 3) {
      Alert.alert("Stream Error", "Failed to load stream after multiple attempts. The stream may be unavailable.");
      return;
    }
    setReconnecting(true);
    reconnectTimeout.current = setTimeout(async () => {
      setReconnecting(false);
      setReconnectCount((c) => c + 1);
      try {
        await videoRef.current?.loadAsync(
          { uri: decodeURIComponent(params.url) },
          { shouldPlay: true, rate: currentSpeed }
        );
      } catch {}
    }, 3000);
  }, [reconnectCount, params.url, currentSpeed]);

  const togglePlay = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    resetControlsTimer();
    if (isPlaying) {
      await videoRef.current?.pauseAsync();
    } else {
      await videoRef.current?.playAsync();
    }
  };

  const seek = async (delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    resetControlsTimer();
    const newPos = Math.max(0, positionMs + delta * 1000);
    await videoRef.current?.setPositionAsync(newPos);
  };

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

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const ss = String(s % 60).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    if (h > 0) return `${h}:${mm}:${ss}`;
    return `${mm}:${ss}`;
  };

  const handleBack = () => {
    if (progress > 0.01) {
      addToHistory({
        id: params.streamId || params.url,
        type: params.type === "live" ? "channel" : "movie",
        name: params.title || "Unknown",
        thumbnail: params.logo || "",
        progress,
        duration: durationMs,
        timestamp: Date.now(),
        url: params.url,
      });
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
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

  const topPad = Platform.OS === "web" ? 16 : insets.top || 16;
  const bottomPad = Platform.OS === "web" ? 16 : insets.bottom || 16;
  const leftPad = Platform.OS === "web" ? 16 : insets.left || 16;
  const rightPad = Platform.OS === "web" ? 16 : insets.right || 16;

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <Pressable style={styles.videoWrapper} onPress={handleTap}>
        <Video
          ref={videoRef}
          source={{ uri: decodeURIComponent(params.url) }}
          style={styles.video}
          resizeMode={resizeMode}
          shouldPlay
          useNativeControls={false}
          onPlaybackStatusUpdate={setStatus}
          onError={handleError}
          rate={currentSpeed}
        />

        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color={Colors.accent} size="large" />
            <Text style={styles.bufferingText}>
              {reconnecting ? `Reconnecting... (${reconnectCount + 1}/3)` : "Loading stream..."}
            </Text>
          </View>
        )}

        {showControls && (
          <View style={styles.controls} pointerEvents="box-none">
            <View style={[styles.topBar, { paddingTop: topPad, paddingLeft: leftPad, paddingRight: rightPad }]}>
              <Pressable style={styles.iconBtn} onPress={handleBack}>
                <Ionicons name="chevron-back" size={22} color="#fff" />
              </Pressable>
              <Text style={styles.titleText} numberOfLines={1}>{params.title}</Text>
              <View style={styles.topControls}>
                {!isLive && (
                  <Pressable
                    style={styles.iconBtn}
                    onPress={() => { setShowSpeedMenu((v) => !v); resetControlsTimer(); }}
                  >
                    <Text style={styles.speedLabel}>{currentSpeed === 1 ? "1x" : `${currentSpeed}x`}</Text>
                  </Pressable>
                )}
                <Pressable style={styles.iconBtn} onPress={cycleResizeMode}>
                  <Text style={styles.resizeBtnLabel}>{resizeModeLabel}</Text>
                </Pressable>
              </View>
            </View>

            {showSpeedMenu && (
              <View style={[styles.speedMenu, { top: topPad + 52, right: rightPad + 48 }]}>
                {SPEEDS.map((s, i) => (
                  <Pressable
                    key={s}
                    style={[styles.speedMenuItem, i === speedIdx && styles.speedMenuItemActive]}
                    onPress={() => changeSpeed(i)}
                  >
                    <Text style={[styles.speedMenuText, i === speedIdx && styles.speedMenuTextActive]}>
                      {s === 1 ? "Normal" : `${s}x`}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            <View style={styles.centerControls}>
              {!isLive && (
                <Pressable style={styles.seekBtn} onPress={() => seek(-10)}>
                  <Ionicons name="play-back" size={26} color="#fff" />
                  <Text style={styles.seekLabel}>10s</Text>
                </Pressable>
              )}
              <Pressable style={styles.playBtn} onPress={togglePlay}>
                <Ionicons name={isPlaying ? "pause" : "play"} size={38} color="#fff" />
              </Pressable>
              {!isLive && (
                <Pressable style={styles.seekBtn} onPress={() => seek(10)}>
                  <Ionicons name="play-forward" size={26} color="#fff" />
                  <Text style={styles.seekLabel}>10s</Text>
                </Pressable>
              )}
            </View>

            <View style={[styles.bottomBar, { paddingBottom: bottomPad + 4, paddingLeft: leftPad, paddingRight: rightPad }]}>
              {isLive ? (
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.timeText}>{formatTime(positionMs)}</Text>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${Math.min(progress * 100, 100)}%` as any }]} />
                    <View style={[styles.progressThumb, { left: `${Math.min(progress * 100, 100)}%` as any }]} />
                  </View>
                  <Text style={styles.timeText}>{formatTime(durationMs)}</Text>
                </>
              )}
            </View>
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  videoWrapper: {
    flex: 1,
    backgroundColor: "#000",
  },
  video: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    gap: 14,
  },
  bufferingText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  controls: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.38)",
    justifyContent: "space-between",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 12,
    gap: 12,
  },
  iconBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  titleText: {
    flex: 1,
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  topControls: {
    flexDirection: "row",
    gap: 8,
  },
  speedLabel: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  resizeBtnLabel: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  speedMenu: {
    position: "absolute",
    backgroundColor: "rgba(10,10,20,0.95)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: "hidden",
    minWidth: 120,
    zIndex: 20,
  },
  speedMenuItem: {
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  speedMenuItemActive: {
    backgroundColor: Colors.accentSoft,
  },
  speedMenuText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    textAlign: "center",
  },
  speedMenuTextActive: {
    color: Colors.accent,
    fontFamily: "Inter_700Bold",
  },
  centerControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 48,
  },
  seekBtn: {
    alignItems: "center",
    gap: 4,
  },
  seekLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
  playBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.35)",
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 12,
    gap: 10,
  },
  timeText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    minWidth: 44,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 2,
    overflow: "visible",
    position: "relative",
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.accent,
    borderRadius: 2,
  },
  progressThumb: {
    position: "absolute",
    top: -5,
    marginLeft: -6,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#fff",
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.danger,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#fff",
  },
  liveText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  errorText: {
    color: Colors.text,
    fontSize: 16,
    fontFamily: "Inter_500Medium",
  },
  errorBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
});
