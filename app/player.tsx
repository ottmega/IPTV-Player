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

const RESIZE_MODES: { mode: ResizeMode; label: string }[] = [
  { mode: ResizeMode.CONTAIN, label: "Fit" },
  { mode: ResizeMode.COVER, label: "Fill" },
  { mode: ResizeMode.STRETCH, label: "Stretch" },
];
const SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
const SUBTITLE_TRACKS = ["Disabled", "English", "Arabic", "French", "Spanish", "Hindi"];
const AUDIO_TRACKS = ["Auto (Default)", "Track 2", "Track 3", "Track 4", "Track 5"];

type BufferMode = "small" | "medium" | "large";
type DecoderMode = "auto" | "software";
const BUFFER_DELAYS: Record<BufferMode, number> = { small: 1500, medium: 3000, large: 6000 };
const SUPPORTED_CODECS = ["AAC", "AC3", "EAC3", "MP3", "DTS (via VLC)", "HE-AAC", "OPUS", "H.264", "H.265/HEVC"];

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
  const [showSettings, setShowSettings] = useState(false);
  const [bufferMode, setBufferMode] = useState<BufferMode>("medium");
  const [decoderMode, setDecoderMode] = useState<DecoderMode>("auto");
  const [audioDelay, setAudioDelay] = useState(0);

  const videoRef = useRef<Video>(null);
  const controlsTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const zapTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const zapAnim = useRef(new Animated.Value(0)).current;

  const isPlaying = status?.isLoaded ? status.isPlaying : false;
  const isLoading = !status?.isLoaded || reconnecting;
  const isMuted = status?.isLoaded ? status.isMuted : false;
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

  const openInVLC = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const vlcUrl = `vlc://${currentUrl}`;
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
  }, [currentUrl]);

  const handleError = useCallback(() => {
    if (reconnectCount >= 3) {
      Alert.alert(
        "Stream Error",
        "Failed to load stream after multiple attempts.\n\nTry opening in VLC for better codec support.",
        [
          { text: "Open in VLC", onPress: () => openInVLC() },
          { text: "Dismiss" },
        ]
      );
      return;
    }
    setReconnecting(true);
    reconnectTimeout.current = setTimeout(async () => {
      setReconnecting(false);
      setReconnectCount((c) => c + 1);
      try {
        await videoRef.current?.loadAsync({ uri: currentUrl }, { shouldPlay: true, rate: currentSpeed });
      } catch {}
    }, BUFFER_DELAYS[bufferMode]);
  }, [reconnectCount, currentUrl, currentSpeed, bufferMode, openInVLC]);

  const reloadStream = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    resetControlsTimer();
    setReconnecting(true);
    setReconnectCount(0);
    try {
      await videoRef.current?.stopAsync();
      await videoRef.current?.loadAsync({ uri: currentUrl }, { shouldPlay: true, rate: currentSpeed });
    } catch {}
    setReconnecting(false);
  };

  const toggleMute = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    resetControlsTimer();
    await videoRef.current?.setIsMutedAsync(!isMuted);
  };

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
                <Pressable style={styles.iconBtn} onPress={reloadStream} testID="player-reload">
                  <Ionicons name="refresh-outline" size={18} color="#fff" />
                </Pressable>
                <Pressable style={styles.iconBtn} onPress={toggleMute} testID="player-mute">
                  <Ionicons name={isMuted ? "volume-mute" : "volume-high-outline"} size={18} color={isMuted ? Colors.danger : "#fff"} />
                </Pressable>
                <Pressable style={styles.iconBtn} onPress={() => { setShowSettings(true); resetControlsTimer(); }} testID="player-settings">
                  <Ionicons name="settings-outline" size={18} color="#fff" />
                </Pressable>
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
                onSelect={(i) => {
                  setAudioIdx(i);
                  setShowAudioMenu(false);
                  resetControlsTimer();
                  reloadStream();
                }}
                right={rightPad + 8}
                top={topPad + 52}
                title="Audio Track"
                subtitle="Selecting a track reloads the stream"
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

            {isMuted && isPlaying && (
              <Pressable
                style={[styles.noAudioBanner, { bottom: bottomPad + 56 }]}
                onPress={toggleMute}
                testID="player-no-audio-banner"
              >
                <Ionicons name="volume-mute" size={14} color={Colors.danger} />
                <Text style={styles.noAudioText}>Audio muted — tap to unmute</Text>
                <Ionicons name="close-outline" size={14} color="rgba(255,255,255,0.6)" />
              </Pressable>
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

      <PlayerSettingsSheet
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        bufferMode={bufferMode}
        onBufferMode={setBufferMode}
        decoderMode={decoderMode}
        onDecoderMode={setDecoderMode}
        audioDelay={audioDelay}
        onAudioDelay={setAudioDelay}
        onOpenInVLC={openInVLC}
        onReload={() => { setShowSettings(false); reloadStream(); }}
        streamUrl={currentUrl}
      />
    </View>
  );
}

function PlayerSettingsSheet({
  visible, onClose, bufferMode, onBufferMode, decoderMode, onDecoderMode,
  audioDelay, onAudioDelay, onOpenInVLC, onReload, streamUrl,
}: {
  visible: boolean; onClose: () => void;
  bufferMode: BufferMode; onBufferMode: (m: BufferMode) => void;
  decoderMode: DecoderMode; onDecoderMode: (m: DecoderMode) => void;
  audioDelay: number; onAudioDelay: (d: number) => void;
  onOpenInVLC: () => void; onReload: () => void; streamUrl: string;
}) {
  const format = streamUrl.split("?")[0].split(".").pop()?.toUpperCase() || "STREAM";
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

            {/* Engine Section */}
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

            {/* Buffer Section */}
            <Text style={st.sectionLabel}>RECONNECT BUFFER</Text>
            <View style={st.toggleRow}>
              {(["small", "medium", "large"] as BufferMode[]).map((m) => (
                <Pressable
                  key={m}
                  style={[st.toggleBtn, bufferMode === m && st.toggleBtnActive]}
                  onPress={() => onBufferMode(m)}
                >
                  <Text style={[st.toggleBtnText, bufferMode === m && st.toggleBtnTextActive]}>
                    {m === "small" ? "Fast (1.5s)" : m === "medium" ? "Normal (3s)" : "Large (6s)"}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={st.hint}>Larger buffer reduces audio dropouts on slow networks</Text>

            {/* Decoder Section */}
            <Text style={st.sectionLabel}>DECODER MODE</Text>
            <View style={st.toggleRow}>
              {(["auto", "software"] as DecoderMode[]).map((m) => (
                <Pressable
                  key={m}
                  style={[st.toggleBtn, decoderMode === m && st.toggleBtnActive]}
                  onPress={() => onDecoderMode(m)}
                >
                  <Text style={[st.toggleBtnText, decoderMode === m && st.toggleBtnTextActive]}>
                    {m === "auto" ? "Auto (Hardware)" : "Software"}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={st.hint}>Software decoder fixes audio on some AC3/EAC3 streams · takes effect on reload</Text>

            {/* Audio Delay Section */}
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
            <Text style={st.hint}>Apply then reload stream for effect</Text>

            {/* Stream Info */}
            <Text style={st.sectionLabel}>STREAM INFO</Text>
            <View style={st.infoCard}>
              <View style={st.infoRow}>
                <Ionicons name="film-outline" size={14} color={Colors.textMuted} />
                <Text style={st.infoKey}>Format</Text>
                <Text style={st.infoVal}>{format}</Text>
              </View>
              <View style={st.infoRow}>
                <Ionicons name="musical-note-outline" size={14} color={Colors.textMuted} />
                <Text style={st.infoKey}>Decoder</Text>
                <Text style={st.infoVal}>{decoderMode === "auto" ? "Hardware (Auto)" : "Software"}</Text>
              </View>
              <View style={st.infoRow}>
                <Ionicons name="server-outline" size={14} color={Colors.textMuted} />
                <Text style={st.infoKey}>Buffer</Text>
                <Text style={st.infoVal}>{BUFFER_DELAYS[bufferMode] / 1000}s reconnect</Text>
              </View>
            </View>

            {/* Codec Support */}
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

function TrackMenu({ items, activeIdx, onSelect, right, top, title, subtitle }: {
  items: string[]; activeIdx: number; onSelect: (i: number) => void;
  right: number; top: number; title: string; subtitle?: string;
}) {
  return (
    <View style={[styles.trackMenu, { right, top }]}>
      <Text style={styles.trackMenuTitle}>{title}</Text>
      {subtitle && <Text style={styles.trackMenuSubtitle}>{subtitle}</Text>}
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
  trackMenuSubtitle: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textMuted, paddingHorizontal: 16, paddingBottom: 8, paddingTop: 4, borderBottomWidth: 1, borderBottomColor: Colors.border + "60" },
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
  noAudioBanner: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.82)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: Colors.danger + "60",
  },
  noAudioText: { flex: 1, color: "#fff", fontSize: 12, fontFamily: "Inter_500Medium" },
});

const st = StyleSheet.create({
  sheetOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: {
    backgroundColor: "#0B1525",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
    paddingBottom: 24,
    borderTopWidth: 1,
    borderColor: Colors.cardBorder,
  },
  sheetHandle: { width: 36, height: 4, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 2, alignSelf: "center", marginTop: 10, marginBottom: 4 },
  sheetHeader: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  sheetTitle: { flex: 1, color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  sectionLabel: { color: Colors.textMuted, fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1.2, textTransform: "uppercase", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  row: { flexDirection: "row", gap: 10, paddingHorizontal: 20 },
  engineCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    padding: 14,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: "center",
  },
  engineCardActive: { borderColor: Colors.accent, backgroundColor: Colors.accentSoft },
  engineLabel: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  engineSub: { color: Colors.textMuted, fontSize: 10, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 15 },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.accent, marginTop: 4 },
  toggleRow: { flexDirection: "row", gap: 8, paddingHorizontal: 20 },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
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
  infoCard: { marginHorizontal: 20, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 14, gap: 10, borderWidth: 1, borderColor: Colors.cardBorder },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  infoKey: { color: Colors.textMuted, fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 },
  infoVal: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  codecGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 20, paddingBottom: 4 },
  codecChip: { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: Colors.cardBorder },
  codecText: { color: Colors.textSecondary, fontSize: 11, fontFamily: "Inter_500Medium" },
  actionRow: { flexDirection: "row", gap: 10, paddingHorizontal: 20, paddingTop: 20 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  actionBtnVLC: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  actionBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
