import React, { useState, useRef, useEffect, useCallback } from "react";
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

const RESIZE_MODES: { mode: ResizeMode; label: string }[] = [
  { mode: ResizeMode.CONTAIN, label: "Fit" },
  { mode: ResizeMode.COVER, label: "Fill" },
  { mode: ResizeMode.STRETCH, label: "Stretch" },
];
const SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
const SUBTITLE_TRACKS = ["Disabled", "English", "Arabic", "French", "Spanish", "Hindi"];
const AUDIO_TRACKS = ["Track 1 (Default)", "Track 2 (English)", "Track 3 (Arabic)", "Track 4 (Hindi)"];

export default function PlayerScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const params = useLocalSearchParams<{
    url: string; title: string; logo?: string; type?: string;
    streamId?: string; genre?: string; year?: string; episode?: string;
  }>();
  const { addToHistory, channels, getStreamUrl } = useIPTV();

  const [status, setStatus] = useState<AVPlaybackStatus | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [resizeModeIdx, setResizeModeIdx] = useState(0);
  const [speedIdx, setSpeedIdx] = useState(2);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showSubMenu, setShowSubMenu] = useState(false);
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [showInfoBar, setShowInfoBar] = useState(false);
  const [subtitleIdx, setSubtitleIdx] = useState(0);
  const [audioIdx, setAudioIdx] = useState(0);
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectCount, setReconnectCount] = useState(0);
  const [currentUrl, setCurrentUrl] = useState(decodeURIComponent(params.url));
  const [currentTitle, setCurrentTitle] = useState(params.title || "");
  const [currentStreamId, setCurrentStreamId] = useState(params.streamId || "");
  const [zapBanner, setZapBanner] = useState<string | null>(null);

  const videoRef = useRef<Video>(null);
  const controlsTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const zapTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const zapAnim = useRef(new Animated.Value(0)).current;

  const isPlaying = status?.isLoaded ? status.isPlaying : false;
  const isLoading = !status?.isLoaded || reconnecting;
  const progress = status?.isLoaded && status.durationMillis ? status.positionMillis / status.durationMillis : 0;
  const positionMs = status?.isLoaded ? status.positionMillis : 0;
  const durationMs = status?.isLoaded ? (status.durationMillis ?? 0) : 0;
  const isLive = params.type === "live" || durationMs === 0;
  const resizeMode = RESIZE_MODES[resizeModeIdx].mode;
  const resizeModeLabel = RESIZE_MODES[resizeModeIdx].label;
  const currentSpeed = SPEEDS[speedIdx];

  const currentChannelIdx = channels.findIndex((c) => c.streamId === currentStreamId);

  const showZapBanner = (channelName: string) => {
    setZapBanner(channelName);
    Animated.sequence([
      Animated.timing(zapAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1600),
      Animated.timing(zapAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setZapBanner(null));
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 8 && Math.abs(g.dx) < Math.abs(g.dy),
    onPanResponderRelease: (_, g) => {
      if (isLive && channels.length > 1 && Math.abs(g.dy) > 50 && Math.abs(g.dx) < 80) {
        if (g.dy < -50) switchChannel("next");
        else switchChannel("prev");
      } else if (Math.abs(g.dx) < 5 && Math.abs(g.dy) < 5) {
        handleTap();
      }
    },
  });

  useEffect(() => {
    if (Platform.OS !== "web") {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    }
    return () => {
      if (Platform.OS !== "web") {
        ScreenOrientation.unlockAsync();
      }
    };
  }, []);

  useEffect(() => {
    resetControlsTimer();
    return () => {
      if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      if (zapTimeout.current) clearTimeout(zapTimeout.current);
    };
  }, []);

  const resetControlsTimer = () => {
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    setShowControls(true);
    controlsTimeout.current = setTimeout(() => {
      setShowControls(false);
      setShowSpeedMenu(false);
      setShowSubMenu(false);
      setShowAudioMenu(false);
      setShowInfoBar(false);
    }, 5000);
  };

  const handleTap = () => resetControlsTimer();

  const handleError = useCallback(() => {
    if (reconnectCount >= 3) {
      Alert.alert("Stream Error", "Failed to load stream after multiple attempts.");
      return;
    }
    setReconnecting(true);
    reconnectTimeout.current = setTimeout(async () => {
      setReconnecting(false);
      setReconnectCount((c) => c + 1);
      try {
        await videoRef.current?.loadAsync({ uri: currentUrl }, { shouldPlay: true, rate: currentSpeed });
      } catch {}
    }, 3000);
  }, [reconnectCount, currentUrl, currentSpeed]);

  const togglePlay = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    resetControlsTimer();
    isPlaying ? await videoRef.current?.pauseAsync() : await videoRef.current?.playAsync();
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

  const switchChannel = async (direction: "next" | "prev") => {
    if (channels.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    resetControlsTimer();
    let nextIdx = direction === "next"
      ? (currentChannelIdx + 1) % channels.length
      : (currentChannelIdx - 1 + channels.length) % channels.length;
    const nextChannel = channels[nextIdx];
    const nextUrl = nextChannel.url || getStreamUrl("live", nextChannel.streamId, "ts");
    setCurrentTitle(nextChannel.name);
    setCurrentStreamId(nextChannel.streamId);
    setCurrentUrl(nextUrl);
    setReconnectCount(0);
    showZapBanner(nextChannel.name);
    try {
      await videoRef.current?.loadAsync({ uri: nextUrl }, { shouldPlay: true });
    } catch {}
  };

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const ss = String(s % 60).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
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

  const topPad = Platform.OS === "web" ? 12 : insets.top || 12;
  const bottomPad = Platform.OS === "web" ? 12 : insets.bottom || 12;
  const leftPad = Platform.OS === "web" ? 12 : insets.left || 12;
  const rightPad = Platform.OS === "web" ? 12 : insets.right || 12;

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
          <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
            <LinearGradient
              colors={["rgba(0,0,0,0.72)", "transparent"]}
              style={[styles.topGrad, { height: topPad + 70 }]}
            />
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.72)"]}
              style={[styles.bottomGrad, { height: bottomPad + 90 }]}
            />

            <View style={[styles.topBar, { paddingTop: topPad, paddingLeft: leftPad, paddingRight: rightPad }]}>
              <Pressable style={styles.iconBtn} onPress={handleBack} testID="player-back">
                <Ionicons name="chevron-back" size={22} color="#fff" />
              </Pressable>
              <View style={styles.titleBlock}>
                <Text style={styles.titleText} numberOfLines={1}>{currentTitle}</Text>
                {(params.genre || params.year) && (
                  <Text style={styles.subtitleText} numberOfLines={1}>
                    {[params.year, params.genre, params.episode].filter(Boolean).join(" · ")}
                  </Text>
                )}
              </View>
              <View style={styles.topControls}>
                <Pressable style={styles.iconBtn} onPress={() => { setShowInfoBar((v) => !v); resetControlsTimer(); }}>
                  <Ionicons name="information-circle-outline" size={20} color="#fff" />
                </Pressable>
                {!isLive && (
                  <Pressable style={styles.iconBtn} onPress={() => { setShowSpeedMenu((v) => !v); setShowSubMenu(false); setShowAudioMenu(false); resetControlsTimer(); }}>
                    <Text style={styles.controlLabel}>{currentSpeed === 1 ? "1x" : `${currentSpeed}x`}</Text>
                  </Pressable>
                )}
                <Pressable style={styles.iconBtn} onPress={cycleResizeMode}>
                  <Text style={styles.controlLabel}>{resizeModeLabel}</Text>
                </Pressable>
                <Pressable style={styles.iconBtn} onPress={() => { setShowSubMenu((v) => !v); setShowSpeedMenu(false); setShowAudioMenu(false); resetControlsTimer(); }}>
                  <Ionicons name="text-outline" size={18} color={subtitleIdx > 0 ? Colors.accent : "#fff"} />
                </Pressable>
                <Pressable style={styles.iconBtn} onPress={() => { setShowAudioMenu((v) => !v); setShowSubMenu(false); setShowSpeedMenu(false); resetControlsTimer(); }}>
                  <Ionicons name="musical-notes-outline" size={18} color={audioIdx > 0 ? Colors.accent : "#fff"} />
                </Pressable>
              </View>
            </View>

            {showSpeedMenu && (
              <TrackMenu
                items={SPEEDS.map((s) => (s === 1 ? "Normal" : `${s}x`))}
                activeIdx={speedIdx}
                onSelect={(i) => changeSpeed(i)}
                right={rightPad + 8}
                top={topPad + 52}
                title="Playback Speed"
              />
            )}
            {showSubMenu && (
              <TrackMenu
                items={SUBTITLE_TRACKS}
                activeIdx={subtitleIdx}
                onSelect={(i) => { setSubtitleIdx(i); setShowSubMenu(false); resetControlsTimer(); }}
                right={rightPad + 8}
                top={topPad + 52}
                title="Subtitles"
              />
            )}
            {showAudioMenu && (
              <TrackMenu
                items={AUDIO_TRACKS}
                activeIdx={audioIdx}
                onSelect={(i) => { setAudioIdx(i); setShowAudioMenu(false); resetControlsTimer(); }}
                right={rightPad + 8}
                top={topPad + 52}
                title="Audio Track"
              />
            )}

            <View style={styles.centerControls}>
              {isLive && channels.length > 1 && (
                <Pressable style={styles.channelNavBtn} onPress={() => switchChannel("prev")}>
                  <Ionicons name="play-skip-back" size={24} color="#fff" />
                  <Text style={styles.navLabel}>Prev</Text>
                </Pressable>
              )}
              {!isLive && (
                <Pressable style={styles.seekBtn} onPress={() => seek(-10)}>
                  <Ionicons name="play-back" size={26} color="#fff" />
                  <Text style={styles.seekLabel}>10s</Text>
                </Pressable>
              )}
              <Pressable style={styles.playBtn} onPress={togglePlay} testID="player-play">
                <Ionicons name={isPlaying ? "pause" : "play"} size={38} color="#fff" />
              </Pressable>
              {!isLive && (
                <Pressable style={styles.seekBtn} onPress={() => seek(10)}>
                  <Ionicons name="play-forward" size={26} color="#fff" />
                  <Text style={styles.seekLabel}>10s</Text>
                </Pressable>
              )}
              {isLive && channels.length > 1 && (
                <Pressable style={styles.channelNavBtn} onPress={() => switchChannel("next")}>
                  <Ionicons name="play-skip-forward" size={24} color="#fff" />
                  <Text style={styles.navLabel}>Next</Text>
                </Pressable>
              )}
            </View>

            <View style={[styles.bottomBar, { paddingBottom: bottomPad + 4, paddingLeft: leftPad, paddingRight: rightPad }]}>
              {isLive ? (
                <View style={styles.liveRow}>
                  <View style={styles.liveBadge}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>LIVE</Text>
                  </View>
                  <Text style={styles.liveChannelText} numberOfLines={1}>{currentTitle}</Text>
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

            {showInfoBar && (
              <View style={[styles.infoBar, { bottom: bottomPad + 60 }]}>
                <Ionicons name="film" size={16} color={Colors.accent} />
                <Text style={styles.infoTitle}>{currentTitle}</Text>
                {params.genre ? <Text style={styles.infoChip}>{params.genre}</Text> : null}
                {params.year ? <Text style={styles.infoChip}>{params.year}</Text> : null}
                {params.episode ? <Text style={styles.infoChip}>{params.episode}</Text> : null}
                {isLive && currentChannelIdx >= 0 && (
                  <Text style={styles.infoChip}>Ch {currentChannelIdx + 1}</Text>
                )}
              </View>
            )}

            {isLive && (
              <View style={[styles.swipeHint, { bottom: bottomPad + 42 }]}>
                <Ionicons name="chevron-up" size={12} color="rgba(255,255,255,0.35)" />
                <Text style={styles.swipeHintText}>Swipe to zap</Text>
                <Ionicons name="chevron-down" size={12} color="rgba(255,255,255,0.35)" />
              </View>
            )}
          </View>
        )}

        {zapBanner && (
          <Animated.View style={[styles.zapBanner, { opacity: zapAnim }]}>
            <Ionicons name="tv" size={16} color="#fff" />
            <Text style={styles.zapText} numberOfLines={1}>{zapBanner}</Text>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

function TrackMenu({ items, activeIdx, onSelect, right, top, title }: {
  items: string[]; activeIdx: number; onSelect: (i: number) => void; right: number; top: number; title: string;
}) {
  return (
    <View style={[styles.trackMenu, { right, top }]}>
      <Text style={styles.trackMenuTitle}>{title}</Text>
      <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
        {items.map((item, i) => (
          <Pressable
            key={item}
            style={[styles.trackMenuItem, i === activeIdx && styles.trackMenuItemActive]}
            onPress={() => onSelect(i)}
          >
            <Ionicons
              name={i === activeIdx ? "checkmark-circle" : "ellipse-outline"}
              size={15}
              color={i === activeIdx ? Colors.accent : Colors.textMuted}
            />
            <Text style={[styles.trackMenuText, i === activeIdx && styles.trackMenuTextActive]}>
              {item}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  videoWrapper: { flex: 1, backgroundColor: "#000" },
  video: { flex: 1 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.55)", gap: 14 },
  bufferingText: { color: "#fff", fontSize: 14, fontFamily: "Inter_400Regular" },
  topGrad: { position: "absolute", top: 0, left: 0, right: 0 },
  bottomGrad: { position: "absolute", bottom: 0, left: 0, right: 0 },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "flex-start", paddingBottom: 10, gap: 10 },
  iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: "rgba(0,0,0,0.4)" },
  titleBlock: { flex: 1, paddingTop: 4 },
  titleText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  subtitleText: { color: "rgba(255,255,255,0.65)", fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  topControls: { flexDirection: "row", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" },
  controlLabel: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },
  centerControls: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 40 },
  seekBtn: { alignItems: "center", gap: 3 },
  seekLabel: { color: "rgba(255,255,255,0.7)", fontSize: 10, fontFamily: "Inter_400Regular" },
  channelNavBtn: { alignItems: "center", gap: 3, paddingHorizontal: 8 },
  navLabel: { color: "rgba(255,255,255,0.7)", fontSize: 10, fontFamily: "Inter_400Regular" },
  playBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(255,255,255,0.3)" },
  bottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 10 },
  liveRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: Colors.danger, borderRadius: 5, paddingHorizontal: 10, paddingVertical: 4 },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#fff" },
  liveText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  liveChannelText: { flex: 1, color: "rgba(255,255,255,0.8)", fontSize: 13, fontFamily: "Inter_500Medium" },
  timeText: { color: "#fff", fontSize: 12, fontFamily: "Inter_500Medium", minWidth: 44 },
  progressTrack: { flex: 1, height: 4, backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 2, overflow: "visible", position: "relative" },
  progressFill: { height: "100%", backgroundColor: Colors.accent, borderRadius: 2 },
  progressThumb: { position: "absolute", top: -5, marginLeft: -6, width: 14, height: 14, borderRadius: 7, backgroundColor: "#fff" },
  trackMenu: {
    position: "absolute",
    backgroundColor: "rgba(8,8,20,0.97)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    minWidth: 200,
    maxWidth: 260,
    zIndex: 30,
    overflow: "hidden",
  },
  trackMenuTitle: { fontSize: 12, fontFamily: "Inter_700Bold", color: Colors.textMuted, letterSpacing: 1, textTransform: "uppercase", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  trackMenuItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border + "80" },
  trackMenuItemActive: { backgroundColor: Colors.accentSoft },
  trackMenuText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  trackMenuTextActive: { color: Colors.accent, fontFamily: "Inter_600SemiBold" },
  infoBar: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.75)",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    flexWrap: "wrap",
  },
  infoTitle: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold", flex: 1 },
  infoChip: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  zapBanner: {
    position: "absolute",
    top: "50%",
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.82)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.accent + "70",
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    maxWidth: 280,
  },
  zapText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold", flex: 1 },
  swipeHint: {
    position: "absolute",
    right: 14,
    flexDirection: "column",
    alignItems: "center",
    gap: 3,
    opacity: 0.6,
  },
  swipeHintText: { color: "rgba(255,255,255,0.35)", fontSize: 8, fontFamily: "Inter_400Regular" },
  errorContainer: { flex: 1, backgroundColor: Colors.bg, alignItems: "center", justifyContent: "center", gap: 16 },
  errorText: { color: Colors.text, fontSize: 16, fontFamily: "Inter_500Medium" },
  errorBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.accent },
});
