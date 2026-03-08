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

export default function PlayerScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ url: string; title: string; logo?: string; type?: string; streamId?: string }>();
  const { addToHistory } = useIPTV();

  const [status, setStatus] = useState<AVPlaybackStatus | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [resizeMode, setResizeMode] = useState<ResizeMode>(ResizeMode.CONTAIN);
  const videoRef = useRef<Video>(null);
  const controlsTimeout = useRef<ReturnType<typeof setTimeout>>();

  const isPlaying = status?.isLoaded ? status.isPlaying : false;
  const isLoading = !status?.isLoaded;
  const progress = status?.isLoaded && status.durationMillis
    ? status.positionMillis / status.durationMillis
    : 0;
  const positionMs = status?.isLoaded ? status.positionMillis : 0;
  const durationMs = status?.isLoaded ? (status.durationMillis ?? 0) : 0;

  useEffect(() => {
    return () => {};
  }, []);

  useEffect(() => {
    resetControlsTimer();
    return () => { if (controlsTimeout.current) clearTimeout(controlsTimeout.current); };
  }, []);

  const resetControlsTimer = () => {
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    setShowControls(true);
    controlsTimeout.current = setTimeout(() => setShowControls(false), 4000);
  };

  const handleTap = () => {
    resetControlsTimer();
  };

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
    setResizeMode((prev) => {
      if (prev === ResizeMode.CONTAIN) return ResizeMode.COVER;
      if (prev === ResizeMode.COVER) return ResizeMode.STRETCH;
      return ResizeMode.CONTAIN;
    });
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
        <Pressable style={styles.backBtn2} onPress={() => router.back()}>
          <Text style={{ color: Colors.accent }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const resizeModeLabel =
    resizeMode === ResizeMode.CONTAIN ? "Fit" :
    resizeMode === ResizeMode.COVER ? "Fill" : "Stretch";

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
          onError={() => Alert.alert("Error", "Failed to load stream. The stream may be unavailable.")}
        />

        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color={Colors.accent} size="large" />
            <Text style={styles.bufferingText}>Loading stream...</Text>
          </View>
        )}

        {showControls && (
          <View style={styles.controls}>
            <View style={[styles.topBar, { paddingTop: Platform.OS === "web" ? 16 : insets.top || 16 }]}>
              <Pressable style={styles.iconBtn} onPress={handleBack}>
                <Ionicons name="chevron-back" size={24} color="#fff" />
              </Pressable>
              <Text style={styles.titleText} numberOfLines={1}>{params.title}</Text>
              <Pressable style={styles.iconBtn} onPress={cycleResizeMode}>
                <Text style={styles.resizeLabel}>{resizeModeLabel}</Text>
              </Pressable>
            </View>

            <View style={styles.centerControls}>
              <Pressable style={styles.seekBtn} onPress={() => seek(-10)}>
                <Ionicons name="play-back" size={28} color="#fff" />
                <Text style={styles.seekLabel}>10s</Text>
              </Pressable>
              <Pressable style={styles.playBtn} onPress={togglePlay}>
                <Ionicons
                  name={isPlaying ? "pause" : "play"}
                  size={40}
                  color="#fff"
                />
              </Pressable>
              <Pressable style={styles.seekBtn} onPress={() => seek(10)}>
                <Ionicons name="play-forward" size={28} color="#fff" />
                <Text style={styles.seekLabel}>10s</Text>
              </Pressable>
            </View>

            <View style={[styles.bottomBar, { paddingBottom: Platform.OS === "web" ? 16 : insets.bottom || 16 }]}>
              {durationMs > 0 && (
                <>
                  <Text style={styles.timeText}>{formatTime(positionMs)}</Text>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
                  </View>
                  <Text style={styles.timeText}>{formatTime(durationMs)}</Text>
                </>
              )}
              {durationMs === 0 && params.type === "live" && (
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
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
    backgroundColor: "rgba(0,0,0,0.5)",
    gap: 12,
  },
  bufferingText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  controls: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "space-between",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  titleText: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  resizeLabel: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  centerControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 40,
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
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.4)",
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  timeText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    minWidth: 40,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.accent,
    borderRadius: 2,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.danger,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
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
  backBtn2: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
});
