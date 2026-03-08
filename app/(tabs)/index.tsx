import React, { useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  FlatList,
  Dimensions,
  Platform,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useIPTV } from "@/context/IPTVContext";
import Colors from "@/constants/colors";
import * as Haptics from "expo-haptics";

const { width } = Dimensions.get("window");

const TILES = [
  { key: "live", label: "Live TV", icon: "tv" as const, route: "/(tabs)/live", color: Colors.accent, bg: "#4F8EF7" },
  { key: "movies", label: "Movies", icon: "film" as const, route: "/(tabs)/movies", color: Colors.gradient2, bg: "#7C3AED" },
  { key: "series", label: "Series", icon: "play-circle" as const, route: "/(tabs)/series", color: Colors.success, bg: "#059669" },
  { key: "catchup", label: "Catch Up", icon: "time" as const, route: "/catchup", color: "#F59E0B", bg: "#D97706" },
  { key: "favorites", label: "Favorites", icon: "heart" as const, route: "/favorites", color: "#F87171", bg: "#DC2626" },
  { key: "multiscreen", label: "Multi Screen", icon: "grid" as const, route: "/multiscreen", color: "#22D3EE", bg: "#0891B2" },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { userInfo, channels, movies, series, history, loginType } = useIPTV();

  const continueWatching = history.filter((h) => h.progress && h.progress > 0 && h.progress < 0.95).slice(0, 10);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const leftPadding = Platform.OS === "web" ? 24 : insets.left + 20;
  const rightPadding = Platform.OS === "web" ? 24 : insets.right + 20;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={[styles.header, { paddingLeft: leftPadding, paddingRight: rightPadding }]}>
        <View>
          <Text style={styles.greeting}>Good {getGreeting()}</Text>
          <Text style={styles.username}>{userInfo?.username || "Guest"}</Text>
        </View>
        <View style={styles.headerRight}>
          {userInfo?.expDate && userInfo.expDate !== "N/A" && (
            <View style={styles.expiryBadge}>
              <Ionicons name="calendar-outline" size={12} color={Colors.textMuted} />
              <Text style={styles.expiryText}>Exp: {userInfo.expDate}</Text>
            </View>
          )}
          <Pressable
            style={styles.headerBtn}
            onPress={() => { router.push("/search"); Haptics.selectionAsync(); }}
          >
            <Ionicons name="search" size={20} color={Colors.text} />
          </Pressable>
          <Pressable
            style={styles.headerBtn}
            onPress={() => { router.push("/(tabs)/settings"); Haptics.selectionAsync(); }}
          >
            <Ionicons name="settings-outline" size={20} color={Colors.text} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingLeft: leftPadding, paddingRight: rightPadding, paddingBottom: bottomPadding + 80 },
        ]}
      >
        <View style={styles.statsRow}>
          <StatCard icon="tv" label="Channels" value={channels.length} color={Colors.accent} />
          <StatCard icon="film" label="Movies" value={movies.length} color={Colors.gradient2} />
          <StatCard icon="play-circle" label="Series" value={series.length} color={Colors.success} />
          <StatCard icon="time" label="History" value={history.length} color="#F59E0B" />
        </View>

        <Text style={styles.sectionTitle}>Browse</Text>
        <View style={styles.tilesGrid}>
          {TILES.map((tile) => (
            <TileCard key={tile.key} tile={tile} />
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
              renderItem={({ item }) => <ContinueCard item={item} />}
            />
          </>
        )}

        {history.length > 0 && (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Recently Watched</Text>
              <Pressable onPress={() => router.push("/favorites")}>
                <Text style={styles.seeAll}>See All</Text>
              </Pressable>
            </View>
            <FlatList
              horizontal
              data={history.slice(0, 12)}
              keyExtractor={(item) => item.id + "_rw"}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
              renderItem={({ item }) => <RecentCard item={item} />}
            />
          </>
        )}

        {history.length === 0 && (
          <View style={styles.emptySection}>
            <LinearGradient
              colors={[Colors.gradient1 + "22", Colors.gradient2 + "22"]}
              style={styles.emptyIcon}
            >
              <Ionicons name="play" size={32} color={Colors.accent} />
            </LinearGradient>
            <Text style={styles.emptyTitle}>Ready to Stream</Text>
            <Text style={styles.emptyText}>Connect your playlist and start watching</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function TileCard({ tile }: { tile: typeof TILES[number] }) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => Animated.spring(scale, { toValue: 0.93, useNativeDriver: true, speed: 30 }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20 }).start();

  return (
    <Pressable
      onPress={() => { router.push(tile.route as any); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      <Animated.View style={[styles.tile, { transform: [{ scale }] }]}>
        <LinearGradient
          colors={[tile.bg + "33", tile.bg + "11"]}
          style={styles.tileGradient}
        >
          <View style={[styles.tileIconWrap, { backgroundColor: tile.bg + "28" }]}>
            <Ionicons name={tile.icon} size={32} color={tile.color} />
          </View>
          <Text style={styles.tileLabel}>{tile.label}</Text>
          <Ionicons name="chevron-forward" size={14} color={tile.color + "88"} />
        </LinearGradient>
        <View style={[styles.tileBorderAccent, { backgroundColor: tile.color }]} />
      </Animated.View>
    </Pressable>
  );
}

function ContinueCard({ item }: { item: ReturnType<typeof useIPTV>["history"][number] }) {
  return (
    <Pressable
      style={styles.continueCard}
      onPress={() => router.push({ pathname: "/player", params: { url: item.url, title: item.name } })}
    >
      <View style={styles.continueThumbnail}>
        {item.thumbnail ? (
          <Image source={{ uri: item.thumbnail }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={styles.thumbnailPlaceholder}>
            <Ionicons name="play" size={24} color={Colors.textMuted} />
          </View>
        )}
        <LinearGradient colors={["transparent", "rgba(0,0,0,0.85)"]} style={StyleSheet.absoluteFill} />
        {item.progress !== undefined && (
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${Math.min(item.progress * 100, 100)}%` }]} />
          </View>
        )}
        <View style={styles.playOverlay}>
          <Ionicons name="play-circle" size={36} color="rgba(255,255,255,0.9)" />
        </View>
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
          <View style={styles.thumbnailPlaceholder}>
            <Ionicons name={item.type === "channel" ? "tv" : "film"} size={20} color={Colors.textMuted} />
          </View>
        )}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.7)"]}
          style={styles.recentGradient}
        />
        <View style={styles.recentTypeBadge}>
          <Ionicons
            name={item.type === "channel" ? "tv" : item.type === "movie" ? "film" : "play-circle"}
            size={10}
            color={Colors.accent}
          />
        </View>
      </View>
      <Text style={styles.recentTitle} numberOfLines={2}>{item.name}</Text>
    </Pressable>
  );
}

function StatCard({ icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: color + "22" }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={[styles.statValue, { color }]}>{value.toLocaleString()}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Morning";
  if (h < 17) return "Afternoon";
  return "Evening";
}

const TILE_WIDTH = Math.min((width - 60) / 3, 200);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 12,
  },
  greeting: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  username: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginTop: 1,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  expiryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  expiryText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  scroll: {
    paddingTop: 4,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  statLabel: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginBottom: 12,
    marginTop: 4,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    marginTop: 4,
  },
  seeAll: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.accent,
  },
  tilesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 24,
  },
  tile: {
    width: TILE_WIDTH,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    position: "relative",
  },
  tileGradient: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  tileIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  tileLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  tileBorderAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 3,
    height: "100%",
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  horizontalList: {
    paddingRight: 20,
    gap: 12,
    marginBottom: 8,
  },
  continueCard: {
    width: 180,
  },
  continueThumbnail: {
    width: 180,
    height: 100,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: Colors.surface,
    marginBottom: 8,
  },
  thumbnailPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.card,
  },
  progressBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.accent,
    borderRadius: 2,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  continueTitle: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    lineHeight: 16,
  },
  continueProgress: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    marginTop: 2,
  },
  recentCard: {
    width: 110,
    alignItems: "center",
  },
  recentThumb: {
    width: 110,
    height: 110,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 8,
    backgroundColor: Colors.surface,
  },
  recentGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 48,
  },
  recentTypeBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  recentTitle: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
    textAlign: "center",
    lineHeight: 15,
  },
  emptySection: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 12,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
    maxWidth: 220,
  },
});
