import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Alert,
  Platform,
} from "react-native";
import * as ScreenOrientation from "expo-screen-orientation";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useIPTV, ContentSection, ContentStatus } from "@/context/IPTVContext";
import Colors from "@/constants/colors";

interface SectionState {
  status: ContentStatus;
  count?: number;
}

const SECTIONS: { key: ContentSection; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "live", label: "LIVE TV", icon: "tv" },
  { key: "vod", label: "VOD", icon: "film" },
  { key: "series", label: "SERIES", icon: "play-circle" },
  { key: "guide", label: "GUIDE", icon: "calendar" },
];

export default function LoadingScreen() {
  const { loginWithProgress, pendingLogin, channels, movies, series } = useIPTV();

  const [sections, setSections] = useState<Record<ContentSection, SectionState>>({
    live: { status: "waiting" },
    vod: { status: "waiting" },
    series: { status: "waiting" },
    guide: { status: "waiting" },
  });
  const [currentSection, setCurrentSection] = useState<ContentSection | null>(null);
  const [done, setDone] = useState(false);

  const spinAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    if (!pendingLogin) {
      router.replace("/(tabs)");
      return;
    }
    startLoading();
  }, []);

  const startLoading = async () => {
    try {
      await loginWithProgress((section: ContentSection, status: ContentStatus) => {
        setCurrentSection(status === "done" || status === "error" ? null : section);
        setSections((prev) => ({
          ...prev,
          [section]: { ...prev[section], status },
        }));
      });
      setDone(true);
      setTimeout(async () => {
        if (Platform.OS !== "web") {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
        }
        router.replace("/(tabs)");
      }, 800);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load content";
      Alert.alert("Connection Error", msg, [
        { text: "Go Back", onPress: () => router.replace("/login") },
      ]);
    }
  };

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#050510", "#08081A", "#050510"]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.decorTop} />
      <View style={styles.decorBottom} />

      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <Animated.View style={[styles.logoWrap, { transform: [{ scale: pulseAnim }] }]}>
          <LinearGradient
            colors={[Colors.gradient1, Colors.gradient2]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logo}
          >
            <Ionicons name="play" size={32} color="#fff" />
          </LinearGradient>
        </Animated.View>

        <Text style={styles.brand}>OTTMEGA</Text>
        <Text style={styles.tagline}>Updating Media Contents</Text>

        {!done && currentSection && (
          <View style={styles.statusRow}>
            <Animated.View style={{ transform: [{ rotate: spin }] }}>
              <Ionicons name="reload-circle" size={16} color={Colors.accent} />
            </Animated.View>
            <Text style={styles.statusText}>
              Loading {SECTIONS.find((s) => s.key === currentSection)?.label}...
            </Text>
          </View>
        )}
        {done && (
          <View style={styles.statusRow}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
            <Text style={[styles.statusText, { color: Colors.success }]}>All content loaded</Text>
          </View>
        )}

        <View style={styles.boxesGrid}>
          {SECTIONS.map((sec) => {
            const s = sections[sec.key];
            return (
              <SectionBox
                key={sec.key}
                label={sec.label}
                icon={sec.icon}
                status={s.status}
                spin={spin}
              />
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
}

function SectionBox({
  label,
  icon,
  status,
  spin,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  status: ContentStatus;
  spin: Animated.AnimatedInterpolation<string>;
}) {
  const isLoading = status === "loading";
  const isDone = status === "done";
  const isError = status === "error";
  const isWaiting = status === "waiting";

  const color = isDone ? Colors.success : isError ? Colors.danger : isLoading ? Colors.accent : Colors.textMuted;
  const bgColor = isDone
    ? Colors.success + "18"
    : isError
    ? Colors.danger + "18"
    : isLoading
    ? Colors.accent + "18"
    : Colors.surface;

  return (
    <View style={[styles.box, { backgroundColor: bgColor, borderColor: color + "50" }]}>
      <View style={[styles.boxIcon, { backgroundColor: color + "20" }]}>
        {isLoading ? (
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Ionicons name={icon} size={22} color={color} />
          </Animated.View>
        ) : (
          <Ionicons name={icon} size={22} color={color} />
        )}
      </View>
      <Text style={[styles.boxLabel, { color: Colors.text }]}>{label}</Text>
      <View style={styles.boxStatusRow}>
        {isDone && <Ionicons name="checkmark-circle" size={12} color={Colors.success} />}
        {isError && <Ionicons name="alert-circle" size={12} color={Colors.danger} />}
        {isLoading && <Ionicons name="time-outline" size={12} color={Colors.accent} />}
        {isWaiting && <Ionicons name="ellipsis-horizontal" size={12} color={Colors.textMuted} />}
        <Text
          style={[
            styles.boxStatus,
            isDone && { color: Colors.success },
            isError && { color: Colors.danger },
            isLoading && { color: Colors.accent },
            isWaiting && { color: Colors.textMuted },
          ]}
        >
          {isDone ? "Completed" : isError ? "Failed" : isLoading ? "Loading..." : "Waiting..."}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050510",
    alignItems: "center",
    justifyContent: "center",
  },
  decorTop: {
    position: "absolute",
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: Colors.gradient1 + "12",
    top: -120,
    left: -100,
  },
  decorBottom: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: Colors.gradient2 + "10",
    bottom: -80,
    right: -60,
  },
  content: {
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 40,
  },
  logoWrap: {
    marginBottom: 4,
  },
  logo: {
    width: 76,
    height: 76,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    letterSpacing: 5,
  },
  tagline: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 24,
  },
  statusText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.accent,
  },
  boxesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "center",
    marginTop: 12,
    maxWidth: 560,
  },
  box: {
    width: 120,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
  },
  boxIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  boxLabel: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  boxStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  boxStatus: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
});
