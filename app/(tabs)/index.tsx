import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  FlatList,
  Platform,
  Animated,
  Linking,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useIPTV } from "@/context/IPTVContext";
import { useRemoteConfig, isBannerActive } from "@/context/RemoteConfigContext";
import Colors from "@/constants/colors";
import * as Haptics from "expo-haptics";

function getBreakpoint(w: number): "small" | "normal" | "large" | "tablet" {
  if (w < 380) return "small";
  if (w <= 420) return "normal";
  if (w <= 600) return "large";
  return "tablet";
}

function getFeatureGridCols(w: number, isPortrait: boolean): number {
  if (!isPortrait) {
    if (w < 600) return 4;
    if (w < 900) return 5;
    return 6;
  }
  const bp = getBreakpoint(w);
  if (bp === "small") return 2;
  if (bp === "tablet") return 4;
  return 3;
}

const FEATURE_ITEMS = [
  { key: "live", label: "Live TV", icon: "tv" as const, route: "/(tabs)/live", color: "#4F8EF7", grad: ["#1a3a6e", "#2d5bb5"] as [string, string] },
  { key: "movies", label: "Movies", icon: "film" as const, route: "/(tabs)/movies", color: "#10B981", grad: ["#0a4230", "#0d6648"] as [string, string] },
  { key: "series", label: "Series", icon: "play-circle" as const, route: "/(tabs)/series", color: "#F59E0B", grad: ["#4a2e05", "#7a4d0a"] as [string, string] },
  { key: "epg", label: "EPG Guide", icon: "calendar" as const, route: "/epg", color: "#A855F7", grad: ["#3b1a6e", "#6d2dbf"] as [string, string] },
  { key: "catchup", label: "Catch Up", icon: "time" as const, route: "/catchup", color: "#EC4899", grad: ["#4a1030", "#7a1050"] as [string, string] },
  { key: "favorites", label: "Favorites", icon: "heart" as const, route: "/favorites", color: "#EF4444", grad: ["#4a0f0f", "#7a1a1a"] as [string, string] },
  { key: "search", label: "Search", icon: "search" as const, route: "/search", color: "#6B7280", grad: ["#1f2937", "#374151"] as [string, string] },
];

const LANDSCAPE_TILES = [
  { key: "live", label: "Live TV", icon: "tv" as const, route: "/(tabs)/live", color: "#4F8EF7", grad: ["#1a3a6e", "#2d5bb5"] as [string, string] },
  { key: "epg", label: "EPG Guide", icon: "calendar" as const, route: "/epg", color: "#A855F7", grad: ["#3b1a6e", "#6d2dbf"] as [string, string] },
  { key: "movies", label: "VOD", icon: "film" as const, route: "/(tabs)/movies", color: "#10B981", grad: ["#0a4230", "#0d6648"] as [string, string] },
  { key: "series", label: "Series", icon: "play-circle" as const, route: "/(tabs)/series", color: "#F59E0B", grad: ["#4a2e05", "#7a4d0a"] as [string, string] },
];

const LANDSCAPE_SHORTCUTS = [
  { key: "catchup", label: "Catch Up", icon: "time-outline" as const, route: "/catchup" },
  { key: "multiscreen", label: "Multi Screen", icon: "grid-outline" as const, route: "/multiscreen" },
  { key: "favorites", label: "Favorites", icon: "heart-outline" as const, route: "/favorites" },
  { key: "search", label: "Search", icon: "search-outline" as const, route: "/search" },
  { key: "settings", label: "Settings", icon: "settings-outline" as const, route: "/(tabs)/settings" },
];

function useCurrentTime() {
  const [time, setTime] = useState(getNow());
  useEffect(() => {
    const t = setInterval(() => setTime(getNow()), 10000);
    return () => clearInterval(t);
  }, []);
  return time;
}

function getNow() {
  const now = new Date();
  const h = now.getHours() % 12 || 12;
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ampm = now.getHours() >= 12 ? "PM" : "AM";
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return {
    time: `${String(h).padStart(2, "0")}:${mm} ${ampm}`,
    date: `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]}`,
  };
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { userInfo, channels, movies, series, history } = useIPTV();
  const { config } = useRemoteConfig();
  const { time, date } = useCurrentTime();

  const isPortrait = height > width;
  const isWeb = Platform.OS === "web";
  const bp = getBreakpoint(width);
  const isTablet = bp === "tablet";

  const topPadding = isWeb ? 67 : insets.top;
  const leftPadding = isWeb ? 24 : insets.left + 16;
  const rightPadding = isWeb ? 24 : insets.right + 16;
  const bottomPadding = isWeb ? 34 : insets.bottom;

  const themeColor = config.themeColor || Colors.accent;

  const continueWatching = useMemo(
    () => history.filter((h) => h.progress && h.progress > 0 && h.progress < 0.95).slice(0, 10),
    [history]
  );

  const horizPad = leftPadding + rightPadding;
  const contentWidth = width - horizPad;

  const featureCols = getFeatureGridCols(width, isPortrait);
  const featureGap = 10;
  const featureCardW = Math.floor((contentWidth - featureGap * (featureCols - 1)) / featureCols);

  const landscapeTileW = Math.min((contentWidth - 30) / 4, 160);

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <LinearGradient colors={["#070714", "#0A0A18", "#070714"]} style={StyleSheet.absoluteFill} />

      <View style={[styles.header, { paddingLeft: leftPadding, paddingRight: rightPadding }]}>
        <View style={styles.headerLeft}>
          {config.logo ? (
            <Image source={{ uri: config.logo }} style={styles.headerLogoImg} resizeMode="cover" />
          ) : (
            <LinearGradient
              colors={[themeColor, Colors.gradient2]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.headerLogo}
            >
              <Ionicons name="play" size={14} color="#fff" />
            </LinearGradient>
          )}
          <View>
            <Text style={styles.headerBrand} numberOfLines={1}>OTTMEGA IPTV</Text>
            {!isPortrait || bp !== "small" ? (
              <Text style={styles.headerUser} numberOfLines={1}>{userInfo?.username || "Guest"}</Text>
            ) : null}
          </View>
        </View>

        {(!isPortrait || isTablet) && (
          <View style={styles.headerCenter}>
            <Text style={styles.headerTime}>{time}</Text>
            <Text style={styles.headerDate}>{date}</Text>
          </View>
        )}

        <View style={styles.headerRight}>
          {isPortrait && !isTablet && (
            <View style={styles.headerTimeMini}>
              <Text style={styles.headerTimeMiniText}>{time}</Text>
            </View>
          )}
          <Pressable style={styles.headerBtn} onPress={() => { router.push("/search"); Haptics.selectionAsync(); }}>
            <Ionicons name="search" size={19} color={Colors.text} />
          </Pressable>
          <Pressable style={styles.headerBtn} onPress={() => { router.push("/(tabs)/settings"); Haptics.selectionAsync(); }}>
            <Ionicons name="settings-outline" size={19} color={Colors.text} />
          </Pressable>
        </View>
      </View>

      {!!config.announcement && (
        <AnnouncementBar message={config.announcement} color={themeColor} />
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          {
            paddingLeft: leftPadding,
            paddingRight: rightPadding,
            paddingBottom: bottomPadding + 90,
          },
        ]}
      >
        <View style={[styles.statsRow, isPortrait && bp === "small" && styles.statsRowSmall]}>
          <StatPill icon="tv" value={channels.length} label="Live" color={themeColor} compact={isPortrait && bp === "small"} />
          <StatPill icon="film" value={movies.length} label="Movies" color={Colors.gradient2} compact={isPortrait && bp === "small"} />
          <StatPill icon="play-circle" value={series.length} label="Series" color={Colors.success} compact={isPortrait && bp === "small"} />
          <StatPill icon="time" value={history.length} label="Watched" color="#F59E0B" compact={isPortrait && bp === "small"} />
        </View>

        {isBannerActive(config) && (
          <PromoBanner config={config} themeColor={themeColor} isPortrait={isPortrait} />
        )}

        {isPortrait ? (
          <>
            <Text style={styles.sectionTitle}>Browse</Text>
            <View style={[styles.featureGrid, { gap: featureGap }]}>
              {FEATURE_ITEMS.map((item) => (
                <FeatureCard
                  key={item.key}
                  item={item}
                  cardWidth={featureCardW}
                  bp={bp}
                />
              ))}
            </View>
          </>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Browse</Text>
            <View style={[styles.mainTilesRow, { gap: 10 }]}>
              {LANDSCAPE_TILES.map((tile) => (
                <LandscapeTile key={tile.key} tile={tile} tileWidth={landscapeTileW} />
              ))}
            </View>

            <Text style={styles.sectionTitle}>Quick Access</Text>
            <View style={styles.shortcutsRow}>
              {LANDSCAPE_SHORTCUTS.map((s) => (
                <ShortcutBtn key={s.key} item={s} themeColor={themeColor} />
              ))}
            </View>
          </>
        )}

        {continueWatching.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Continue Watching</Text>
            <FlatList
              horizontal
              data={continueWatching}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
              renderItem={({ item }) => <ContinueCard item={item} themeColor={themeColor} isPortrait={isPortrait} />}
              scrollEnabled={continueWatching.length > 0}
            />
          </>
        )}

        {history.length > 0 && (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Recently Watched</Text>
              <Pressable onPress={() => router.push("/favorites")}>
                <Text style={[styles.seeAll, { color: themeColor }]}>See All</Text>
              </Pressable>
            </View>
            <FlatList
              horizontal
              data={history.slice(0, 12)}
              keyExtractor={(item) => item.id + "_rw"}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
              renderItem={({ item }) => <RecentCard item={item} />}
              scrollEnabled={!!history.length}
            />
          </>
        )}

        {history.length === 0 && (
          <View style={styles.emptySection}>
            <LinearGradient colors={[themeColor + "22", Colors.gradient2 + "22"]} style={styles.emptyIcon}>
              <Ionicons name="play" size={28} color={themeColor} />
            </LinearGradient>
            <Text style={styles.emptyTitle}>Ready to Stream</Text>
            <Text style={styles.emptyText}>Select a category above to start watching</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function AnnouncementBar({ message, color }: { message: string; color: string }) {
  const scrollX = useRef(new Animated.Value(0)).current;
  const [contentWidth, setContentWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    if (contentWidth <= 0 || containerWidth <= 0) return;
    const distance = contentWidth + containerWidth;
    const duration = Math.max(8000, distance * 18);
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(scrollX, { toValue: -contentWidth - 20, duration, useNativeDriver: true, delay: 600 }),
        Animated.timing(scrollX, { toValue: containerWidth, duration: 0, useNativeDriver: true }),
      ])
    );
    scrollX.setValue(containerWidth);
    anim.start();
    return () => anim.stop();
  }, [contentWidth, containerWidth]);

  return (
    <View
      style={[styles.announcementBar, { backgroundColor: color + "22", borderBottomColor: color + "50" }]}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      <Ionicons name="megaphone-outline" size={13} color={color} style={{ marginRight: 8, flexShrink: 0 }} />
      <View style={{ flex: 1, overflow: "hidden" }}>
        <Animated.View
          style={{ transform: [{ translateX: scrollX }], flexDirection: "row" }}
          onLayout={(e) => setContentWidth(e.nativeEvent.layout.width)}
        >
          <Text style={[styles.announcementText, { color }]}>{message}</Text>
        </Animated.View>
      </View>
    </View>
  );
}

function PromoBanner({
  config,
  themeColor,
  isPortrait,
}: {
  config: { banner: string; bannerTitle: string; bannerLink: string };
  themeColor: string;
  isPortrait: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      style={styles.bannerWrap}
      onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 30 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20 }).start()}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (config.bannerLink) Linking.openURL(config.bannerLink).catch(() => {});
      }}
    >
      <Animated.View style={[styles.bannerCard, { height: isPortrait ? 120 : 100 }, { transform: [{ scale }] }]}>
        <Image source={{ uri: config.banner }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <LinearGradient colors={["transparent", "rgba(0,0,0,0.75)"]} style={StyleSheet.absoluteFill} />
        <View style={styles.bannerContent}>
          {config.bannerTitle && (
            <Text style={styles.bannerTitle} numberOfLines={2}>{config.bannerTitle}</Text>
          )}
          <View style={[styles.bannerBtn, { backgroundColor: themeColor }]}>
            <Ionicons name="open-outline" size={12} color="#fff" />
            <Text style={styles.bannerBtnText}>Visit</Text>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

function FeatureCard({
  item,
  cardWidth,
  bp,
}: {
  item: typeof FEATURE_ITEMS[number];
  cardWidth: number;
  bp: "small" | "normal" | "large" | "tablet";
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const iconSize = bp === "small" ? 28 : 32;
  const circleSize = bp === "small" ? 52 : 60;
  const fontSize = bp === "small" ? 11 : 12;

  return (
    <Pressable
      onPress={() => { router.push(item.route as any); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
      onPressIn={() => Animated.spring(scale, { toValue: 0.93, useNativeDriver: true, speed: 30 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20 }).start()}
      style={{ width: cardWidth, minHeight: 48 }}
    >
      <Animated.View style={[styles.featureCard, { transform: [{ scale }] }]}>
        <LinearGradient
          colors={item.grad}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.featureGrad, { paddingVertical: bp === "small" ? 14 : 18 }]}
        >
          <View style={[styles.featureCircle, { width: circleSize, height: circleSize, borderRadius: circleSize / 2, borderColor: item.color + "60" }]}>
            <Ionicons name={item.icon} size={iconSize} color={item.color} />
          </View>
          <Text style={[styles.featureLabel, { fontSize }]} numberOfLines={1}>{item.label}</Text>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

function LandscapeTile({ tile, tileWidth }: { tile: typeof LANDSCAPE_TILES[number]; tileWidth: number }) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      onPress={() => { router.push(tile.route as any); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
      onPressIn={() => Animated.spring(scale, { toValue: 0.92, useNativeDriver: true, speed: 30 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20 }).start()}
      style={{ width: tileWidth }}
    >
      <Animated.View style={[styles.mainTile, { transform: [{ scale }] }]}>
        <LinearGradient colors={tile.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.mainTileGradient}>
          <View style={[styles.mainTileCircle, { borderColor: tile.color + "60" }]}>
            <Ionicons name={tile.icon} size={36} color={tile.color} />
          </View>
          <Text style={styles.mainTileLabel}>{tile.label}</Text>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

function ShortcutBtn({ item, themeColor }: { item: typeof LANDSCAPE_SHORTCUTS[number]; themeColor: string }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.shortcut, pressed && styles.shortcutPressed]}
      onPress={() => { router.push(item.route as any); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
    >
      <View style={[styles.shortcutCircle, { borderColor: themeColor + "30" }]}>
        <Ionicons name={item.icon} size={22} color={themeColor} />
      </View>
      <Text style={styles.shortcutLabel}>{item.label}</Text>
    </Pressable>
  );
}

function StatPill({
  icon,
  value,
  label,
  color,
  compact,
}: {
  icon: any;
  value: number;
  label: string;
  color: string;
  compact?: boolean;
}) {
  return (
    <View style={[styles.statPill, { borderColor: color + "30" }, compact && styles.statPillCompact]}>
      <Ionicons name={icon} size={compact ? 13 : 15} color={color} />
      <Text style={[styles.statValue, { color }, compact && styles.statValueCompact]}>
        {value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}
      </Text>
      {!compact && <Text style={styles.statLabel}>{label}</Text>}
    </View>
  );
}

function ContinueCard({
  item,
  themeColor,
  isPortrait,
}: {
  item: ReturnType<typeof useIPTV>["history"][number];
  themeColor: string;
  isPortrait: boolean;
}) {
  const cardW = isPortrait ? 150 : 170;
  const thumbH = isPortrait ? 85 : 96;

  return (
    <Pressable
      style={{ width: cardW }}
      onPress={() => router.push({ pathname: "/player", params: { url: item.url, title: item.name } })}
    >
      <View style={[styles.continueThumbnail, { width: cardW, height: thumbH }]}>
        {item.thumbnail ? (
          <Image source={{ uri: item.thumbnail }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={styles.thumbPlaceholder}><Ionicons name="play" size={22} color={Colors.textMuted} /></View>
        )}
        <LinearGradient colors={["transparent", "rgba(0,0,0,0.85)"]} style={StyleSheet.absoluteFill} />
        {item.progress !== undefined && (
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${Math.min(item.progress * 100, 100)}%` as any, backgroundColor: themeColor }]} />
          </View>
        )}
        <View style={styles.playOverlay}><Ionicons name="play-circle" size={34} color="rgba(255,255,255,0.9)" /></View>
      </View>
      <Text style={styles.continueTitle} numberOfLines={2}>{item.name}</Text>
      {item.progress !== undefined && (
        <Text style={styles.continueProgress}>{Math.round(item.progress * 100)}% watched</Text>
      )}
    </Pressable>
  );
}

function RecentCard({ item }: { item: ReturnType<typeof useIPTV>["history"][number] }) {
  return (
    <Pressable
      style={styles.recentCard}
      onPress={() => router.push({ pathname: "/player", params: { url: item.url, title: item.name } })}
    >
      <View style={styles.recentThumb}>
        {item.thumbnail ? (
          <Image source={{ uri: item.thumbnail }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={styles.thumbPlaceholder}>
            <Ionicons name={item.type === "channel" ? "tv" : "film"} size={18} color={Colors.textMuted} />
          </View>
        )}
        <View style={styles.recentTypeBadge}>
          <Ionicons name={item.type === "channel" ? "tv" : item.type === "movie" ? "film" : "play-circle"} size={9} color={Colors.accent} />
        </View>
      </View>
      <Text style={styles.recentTitle} numberOfLines={2}>{item.name}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#070714" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 10,
    paddingTop: 4,
    minHeight: 48,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  headerLogo: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  headerLogoImg: { width: 32, height: 32, borderRadius: 10 },
  headerBrand: { fontSize: 13, fontFamily: "Inter_700Bold", color: Colors.text, letterSpacing: 0.8 },
  headerUser: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  headerCenter: { alignItems: "center", flex: 1 },
  headerTime: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text },
  headerDate: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  headerRight: { flexDirection: "row", gap: 6, alignItems: "center" },
  headerTimeMini: { marginRight: 4 },
  headerTimeMiniText: { fontSize: 13, fontFamily: "Inter_700Bold", color: Colors.text },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  announcementBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderBottomWidth: 1,
    overflow: "hidden",
  },
  announcementText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    whiteSpace: "nowrap" as any,
  },
  bannerWrap: { marginBottom: 16 },
  bannerCard: {
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: Colors.surface,
    justifyContent: "flex-end",
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  bannerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
  },
  bannerTitle: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    marginRight: 10,
  },
  bannerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  bannerBtnText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#fff" },
  scroll: { paddingTop: 12 },
  statsRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 16,
  },
  statsRowSmall: { gap: 4 },
  statPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderWidth: 1,
  },
  statPillCompact: { paddingHorizontal: 6, paddingVertical: 6, gap: 4 },
  statValue: { fontSize: 14, fontFamily: "Inter_700Bold" },
  statValueCompact: { fontSize: 12 },
  statLabel: { fontSize: 9, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.textSecondary,
    marginBottom: 10,
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    marginTop: 4,
  },
  seeAll: { fontSize: 12, fontFamily: "Inter_500Medium" },
  featureGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 20,
  },
  featureCard: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    marginBottom: 10,
  },
  featureGrad: {
    alignItems: "center",
    gap: 10,
  },
  featureCircle: {
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  featureLabel: {
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: 0.2,
  },
  mainTilesRow: { flexDirection: "row", marginBottom: 20, flexWrap: "wrap" },
  mainTile: { borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  mainTileGradient: { paddingVertical: 20, alignItems: "center", gap: 12 },
  mainTileCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  mainTileLabel: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 0.3 },
  shortcutsRow: { flexDirection: "row", gap: 8, marginBottom: 20, flexWrap: "wrap" },
  shortcut: { alignItems: "center", gap: 8, minWidth: 64 },
  shortcutPressed: { opacity: 0.7, transform: [{ scale: 0.95 }] },
  shortcutCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  shortcutLabel: { fontSize: 10, fontFamily: "Inter_500Medium", color: Colors.textSecondary, textAlign: "center" },
  horizontalList: { paddingRight: 16, gap: 10, marginBottom: 8 },
  continueThumbnail: {
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: Colors.surface,
    marginBottom: 7,
  },
  thumbPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.card },
  progressBar: { position: "absolute", bottom: 0, left: 0, right: 0, height: 3, backgroundColor: "rgba(255,255,255,0.2)" },
  progressFill: { height: "100%", borderRadius: 2 },
  playOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  continueTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.text, lineHeight: 15 },
  continueProgress: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 2 },
  recentCard: { width: 90, alignItems: "center" },
  recentThumb: {
    width: 90,
    height: 90,
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 6,
    backgroundColor: Colors.surface,
  },
  recentTypeBadge: {
    position: "absolute",
    top: 5,
    left: 5,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  recentTitle: { fontSize: 10, fontFamily: "Inter_500Medium", color: Colors.text, textAlign: "center", lineHeight: 13 },
  emptySection: { alignItems: "center", paddingVertical: 32, gap: 10 },
  emptyIcon: { width: 64, height: 64, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.text },
  emptyText: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textMuted, textAlign: "center", maxWidth: 220 },
});
