import React, { useState, useEffect, useRef } from "react";
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
import { useRemoteConfig } from "@/context/RemoteConfigContext";
import Colors from "@/constants/colors";
import * as Haptics from "expo-haptics";

const MAIN_TILES = [
  { key: "live", label: "Live TV", icon: "tv" as const, route: "/(tabs)/live", color: "#4F8EF7", grad: ["#1a3a6e", "#2d5bb5"] as [string, string] },
  { key: "epg", label: "EPG Guide", icon: "calendar" as const, route: "/epg", color: "#A855F7", grad: ["#3b1a6e", "#6d2dbf"] as [string, string] },
  { key: "movies", label: "VOD", icon: "film" as const, route: "/(tabs)/movies", color: "#10B981", grad: ["#0a4230", "#0d6648"] as [string, string] },
  { key: "series", label: "Series", icon: "play-circle" as const, route: "/(tabs)/series", color: "#F59E0B", grad: ["#4a2e05", "#7a4d0a"] as [string, string] },
];

const SHORTCUTS = [
  { key: "account", label: "Account", icon: "person-circle-outline" as const, route: "/(tabs)/settings" },
  { key: "multiscreen", label: "Multi Screen", icon: "grid-outline" as const, route: "/multiscreen" },
  { key: "catchup", label: "Catch Up", icon: "time-outline" as const, route: "/catchup" },
  { key: "favorites", label: "Favorites", icon: "heart-outline" as const, route: "/favorites" },
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
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return {
    time: `${String(h).padStart(2, "0")}:${mm} ${ampm}`,
    date: `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`,
  };
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { userInfo, channels, movies, series, history } = useIPTV();
  const { config } = useRemoteConfig();
  const { time, date } = useCurrentTime();

  const continueWatching = history.filter((h) => h.progress && h.progress > 0 && h.progress < 0.95).slice(0, 10);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const leftPadding = Platform.OS === "web" ? 24 : insets.left + 16;
  const rightPadding = Platform.OS === "web" ? 24 : insets.right + 16;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  const themeColor = config.themeColor || Colors.accent;
  const TILE_W = Math.min((width - leftPadding - rightPadding - 30) / 4, 160);

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <LinearGradient colors={["#070714", "#0A0A18", "#070714"]} style={StyleSheet.absoluteFill} />

      <View style={[styles.header, { paddingLeft: leftPadding, paddingRight: rightPadding }]}>
        <View style={styles.headerLeft}>
          {config.logo ? (
            <Image
              source={{ uri: config.logo }}
              style={styles.headerLogoImg}
              resizeMode="cover"
            />
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
            <Text style={styles.headerBrand}>OTTMEGA IPTV</Text>
            <Text style={styles.headerUser}>{userInfo?.username || "Guest"}</Text>
          </View>
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTime}>{time}</Text>
          <Text style={styles.headerDate}>{date}</Text>
        </View>
        <View style={styles.headerRight}>
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
        contentContainerStyle={[styles.scroll, { paddingLeft: leftPadding, paddingRight: rightPadding, paddingBottom: bottomPadding + 80 }]}
      >
        <View style={styles.statsRow}>
          <StatPill icon="tv" value={channels.length} label="Live" color={themeColor} />
          <StatPill icon="film" value={movies.length} label="Movies" color={Colors.gradient2} />
          <StatPill icon="play-circle" value={series.length} label="Series" color={Colors.success} />
          <StatPill icon="time" value={history.length} label="Watched" color="#F59E0B" />
        </View>

        {config.showBanner && config.banner && (
          <PromoBanner config={config} themeColor={themeColor} />
        )}

        <Text style={styles.sectionTitle}>Browse</Text>
        <View style={[styles.mainTilesRow, { gap: 10 }]}>
          {MAIN_TILES.map((tile) => (
            <MainTile key={tile.key} tile={tile} tileWidth={TILE_W} />
          ))}
        </View>

        <Text style={styles.sectionTitle}>Quick Access</Text>
        <View style={styles.shortcutsRow}>
          {SHORTCUTS.map((s) => (
            <ShortcutBtn key={s.key} item={s} themeColor={themeColor} />
          ))}
        </View>

        {continueWatching.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Continue Watching</Text>
            <FlatList
              horizontal
              data={continueWatching}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
              renderItem={({ item }) => <ContinueCard item={item} themeColor={themeColor} />}
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

function PromoBanner({ config, themeColor }: { config: { banner: string; bannerTitle: string; bannerLink: string }; themeColor: string }) {
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
      <Animated.View style={[styles.bannerCard, { transform: [{ scale }] }]}>
        <Image source={{ uri: config.banner }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.7)"]}
          style={StyleSheet.absoluteFill}
        />
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

function MainTile({ tile, tileWidth }: { tile: typeof MAIN_TILES[number]; tileWidth: number }) {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () => Animated.spring(scale, { toValue: 0.92, useNativeDriver: true, speed: 30 }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20 }).start();

  return (
    <Pressable
      onPress={() => { router.push(tile.route as any); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
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

function ShortcutBtn({ item, themeColor }: { item: typeof SHORTCUTS[number]; themeColor: string }) {
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

function StatPill({ icon, value, label, color }: { icon: any; value: number; label: string; color: string }) {
  return (
    <View style={[styles.statPill, { borderColor: color + "30" }]}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={[styles.statValue, { color }]}>{value.toLocaleString()}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ContinueCard({ item, themeColor }: { item: ReturnType<typeof useIPTV>["history"][number]; themeColor: string }) {
  return (
    <Pressable
      style={styles.continueCard}
      onPress={() => router.push({ pathname: "/player", params: { url: item.url, title: item.name } })}
    >
      <View style={styles.continueThumbnail}>
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
        <View style={styles.playOverlay}><Ionicons name="play-circle" size={36} color="rgba(255,255,255,0.9)" /></View>
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
          <View style={styles.thumbPlaceholder}><Ionicons name={item.type === "channel" ? "tv" : "film"} size={18} color={Colors.textMuted} /></View>
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
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerLogo: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  headerLogoImg: { width: 32, height: 32, borderRadius: 10 },
  headerBrand: { fontSize: 13, fontFamily: "Inter_700Bold", color: Colors.text, letterSpacing: 1 },
  headerUser: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  headerCenter: { alignItems: "center" },
  headerTime: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text },
  headerDate: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  headerRight: { flexDirection: "row", gap: 6 },
  headerBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.cardBorder },

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

  bannerWrap: { marginBottom: 20 },
  bannerCard: {
    height: 100,
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
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 18 },
  statPill: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.surface, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1 },
  statValue: { fontSize: 16, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  sectionTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.textSecondary, marginBottom: 12, marginTop: 4, textTransform: "uppercase", letterSpacing: 1 },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, marginTop: 4 },
  seeAll: { fontSize: 12, fontFamily: "Inter_500Medium" },
  mainTilesRow: { flexDirection: "row", marginBottom: 20, flexWrap: "wrap" },
  mainTile: { borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  mainTileGradient: { paddingVertical: 20, alignItems: "center", gap: 12 },
  mainTileCircle: { width: 70, height: 70, borderRadius: 35, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center", borderWidth: 2 },
  mainTileLabel: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 0.3 },
  shortcutsRow: { flexDirection: "row", gap: 8, marginBottom: 20, flexWrap: "wrap" },
  shortcut: { alignItems: "center", gap: 8, minWidth: 64 },
  shortcutPressed: { opacity: 0.7, transform: [{ scale: 0.95 }] },
  shortcutCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  shortcutLabel: { fontSize: 10, fontFamily: "Inter_500Medium", color: Colors.textSecondary, textAlign: "center" },
  horizontalList: { paddingRight: 16, gap: 10, marginBottom: 8 },
  continueCard: { width: 170 },
  continueThumbnail: { width: 170, height: 96, borderRadius: 10, overflow: "hidden", backgroundColor: Colors.surface, marginBottom: 7 },
  thumbPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.card },
  progressBar: { position: "absolute", bottom: 0, left: 0, right: 0, height: 3, backgroundColor: "rgba(255,255,255,0.2)" },
  progressFill: { height: "100%", borderRadius: 2 },
  playOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  continueTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.text, lineHeight: 16 },
  continueProgress: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 2 },
  recentCard: { width: 100, alignItems: "center" },
  recentThumb: { width: 100, height: 100, borderRadius: 10, overflow: "hidden", marginBottom: 7, backgroundColor: Colors.surface },
  recentTypeBadge: { position: "absolute", top: 5, left: 5, width: 16, height: 16, borderRadius: 8, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
  recentTitle: { fontSize: 10, fontFamily: "Inter_500Medium", color: Colors.text, textAlign: "center", lineHeight: 13 },
  emptySection: { alignItems: "center", paddingVertical: 32, gap: 10 },
  emptyIcon: { width: 64, height: 64, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.text },
  emptyText: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textMuted, textAlign: "center", maxWidth: 200 },
});
