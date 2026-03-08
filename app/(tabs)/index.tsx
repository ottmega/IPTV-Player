import React, { useState } from "react";
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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useIPTV } from "@/context/IPTVContext";
import Colors from "@/constants/colors";
import * as Haptics from "expo-haptics";

const { width } = Dimensions.get("window");

const TILES = [
  { key: "live", label: "Live TV", icon: "tv-outline" as const, route: "/(tabs)/live", color: "#4F8EF7" },
  { key: "movies", label: "Movies", icon: "film-outline" as const, route: "/(tabs)/movies", color: "#7C3AED" },
  { key: "series", label: "Series", icon: "play-circle-outline" as const, route: "/(tabs)/series", color: "#059669" },
  { key: "catchup", label: "Catch Up", icon: "time-outline" as const, route: "/catchup", color: "#D97706" },
  { key: "favorites", label: "Favorites", icon: "heart-outline" as const, route: "/favorites", color: "#DC2626" },
  { key: "multiscreen", label: "Multi Screen", icon: "grid-outline" as const, route: "/multiscreen", color: "#0891B2" },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { userInfo, channels, movies, series, history, loginType } = useIPTV();

  const continueWatching = history.filter((h) => h.progress && h.progress > 0 && h.progress < 0.95).slice(0, 10);
  const recentlyWatched = history.slice(0, 10);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : 0;

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good {getGreeting()}</Text>
          <Text style={styles.username}>{userInfo?.username || "Guest"}</Text>
        </View>
        <View style={styles.headerRight}>
          <Pressable
            style={styles.headerBtn}
            onPress={() => { router.push("/search"); Haptics.selectionAsync(); }}
          >
            <Ionicons name="search" size={22} color={Colors.text} />
          </Pressable>
          <Pressable
            style={styles.headerBtn}
            onPress={() => { router.push("/(tabs)/settings"); Haptics.selectionAsync(); }}
          >
            <Ionicons name="settings-outline" size={22} color={Colors.text} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPadding + 100 }]}
      >
        <View style={styles.statsRow}>
          <StatBadge icon="tv-outline" label="Channels" value={channels.length} color={Colors.accent} />
          <StatBadge icon="film-outline" label="Movies" value={movies.length} color={Colors.gradient2} />
          <StatBadge icon="play-circle-outline" label="Series" value={series.length} color={Colors.success} />
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

        {recentlyWatched.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recently Watched</Text>
              <Pressable>
                <Text style={styles.seeAll}>See All</Text>
              </Pressable>
            </View>
            <FlatList
              horizontal
              data={recentlyWatched}
              keyExtractor={(item) => item.id + "rw"}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
              renderItem={({ item }) => <RecentCard item={item} />}
            />
          </>
        )}

        {recentlyWatched.length === 0 && (
          <View style={styles.emptySection}>
            <Ionicons name="play-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>Connect your playlist and start watching</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function TileCard({ tile }: { tile: typeof TILES[number] }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
      onPress={() => { router.push(tile.route as string); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
    >
      <View style={[styles.tileIcon, { backgroundColor: tile.color + "22" }]}>
        <Ionicons name={tile.icon} size={28} color={tile.color} />
      </View>
      <Text style={styles.tileLabel}>{tile.label}</Text>
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
          <Image source={{ uri: item.thumbnail }} style={styles.continueThumbnailImg} />
        ) : (
          <View style={[styles.continueThumbnailImg, styles.thumbnailPlaceholder]}>
            <Ionicons name="play" size={24} color={Colors.textMuted} />
          </View>
        )}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.8)"]}
          style={styles.thumbnailOverlay}
        />
        {item.progress !== undefined && (
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${item.progress * 100}%` }]} />
          </View>
        )}
        <View style={styles.playOverlay}>
          <Ionicons name="play-circle" size={32} color="rgba(255,255,255,0.9)" />
        </View>
      </View>
      <Text style={styles.continueTitle} numberOfLines={2}>{item.name}</Text>
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
          <Image source={{ uri: item.thumbnail }} style={styles.recentThumbImg} resizeMode="cover" />
        ) : (
          <View style={[styles.recentThumbImg, styles.thumbnailPlaceholder]}>
            <Ionicons name={item.type === "channel" ? "tv" : "film"} size={20} color={Colors.textMuted} />
          </View>
        )}
      </View>
      <Text style={styles.recentTitle} numberOfLines={2}>{item.name}</Text>
      <Text style={styles.recentType}>{item.type}</Text>
    </Pressable>
  );
}

function StatBadge({ icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <View style={styles.statBadge}>
      <Ionicons name={icon} size={18} color={color} />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  greeting: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  username: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: "row",
    gap: 4,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    paddingHorizontal: 20,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
    marginTop: 8,
  },
  statBadge: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  statValue: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  seeAll: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.accent,
  },
  tilesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 28,
  },
  tile: {
    width: (width - 40 - 24) / 3,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  tilePressed: {
    opacity: 0.75,
    transform: [{ scale: 0.96 }],
  },
  tileIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  tileLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    textAlign: "center",
  },
  horizontalList: {
    paddingRight: 20,
    gap: 12,
    marginBottom: 8,
  },
  continueCard: {
    width: 160,
  },
  continueThumbnail: {
    width: 160,
    height: 90,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: Colors.surface,
    marginBottom: 8,
  },
  continueThumbnailImg: {
    width: "100%",
    height: "100%",
  },
  thumbnailPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.card,
  },
  thumbnailOverlay: {
    ...StyleSheet.absoluteFillObject,
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
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  continueTitle: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
    lineHeight: 16,
  },
  recentCard: {
    width: 100,
    alignItems: "center",
  },
  recentThumb: {
    width: 100,
    height: 100,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 8,
    backgroundColor: Colors.surface,
  },
  recentThumbImg: {
    width: "100%",
    height: "100%",
  },
  recentTitle: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
    textAlign: "center",
    lineHeight: 14,
  },
  recentType: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    textTransform: "capitalize",
    marginTop: 2,
  },
  emptySection: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
    maxWidth: 220,
    lineHeight: 20,
  },
});
