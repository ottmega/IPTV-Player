import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useIPTV } from "@/context/IPTVContext";
import Colors from "@/constants/colors";
import * as Haptics from "expo-haptics";

type Tab = "channels" | "movies" | "series";

export default function FavoritesScreen() {
  const insets = useSafeAreaInsets();
  const { channels, movies, series, favorites, toggleFavorite, getStreamUrl, addToHistory } = useIPTV();
  const [activeTab, setActiveTab] = useState<Tab>("channels");

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  const favChannels = useMemo(
    () => channels.filter((c) => favorites.channels.includes(c.streamId)),
    [channels, favorites.channels]
  );

  const favMovies = useMemo(
    () => movies.filter((m) => favorites.movies.includes(m.streamId)),
    [movies, favorites.movies]
  );

  const favSeries = useMemo(
    () => series.filter((s) => favorites.series.includes(s.seriesId)),
    [series, favorites.series]
  );

  const tabData = { channels: favChannels, movies: favMovies, series: favSeries };
  const counts = { channels: favChannels.length, movies: favMovies.length, series: favSeries.length };

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.title}>Favorites</Text>
      </View>

      <View style={styles.tabsRow}>
        {(["channels", "movies", "series"] as Tab[]).map((tab) => (
          <Pressable
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => { setActiveTab(tab); Haptics.selectionAsync(); }}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
            {counts[tab] > 0 && (
              <View style={[styles.badge, activeTab === tab && styles.badgeActive]}>
                <Text style={[styles.badgeText, activeTab === tab && styles.badgeTextActive]}>
                  {counts[tab]}
                </Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>

      {activeTab === "channels" && (
        <FlatList
          data={favChannels}
          keyExtractor={(c) => c.streamId}
          contentContainerStyle={[styles.list, { paddingBottom: bottomPadding + 100 }]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.channelRow, pressed && { opacity: 0.75 }]}
              onPress={() => {
                const url = item.url || getStreamUrl("live", item.streamId);
                addToHistory({ id: item.streamId, type: "channel", name: item.name, thumbnail: item.streamIcon, timestamp: Date.now(), url });
                router.push({ pathname: "/player", params: { url, title: item.name, type: "live" } });
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <View style={styles.channelLogo}>
                {item.streamIcon ? (
                  <Image source={{ uri: item.streamIcon }} style={{ width: 32, height: 32 }} resizeMode="contain" />
                ) : (
                  <Ionicons name="tv" size={20} color={Colors.textMuted} />
                )}
              </View>
              <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
              <Pressable onPress={() => { toggleFavorite("channels", item.streamId); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
                <Ionicons name="heart" size={20} color={Colors.danger} />
              </Pressable>
              <Ionicons name="play-circle-outline" size={24} color={Colors.accent} />
            </Pressable>
          )}
          ListEmptyComponent={<EmptyState type="channels" />}
        />
      )}

      {activeTab === "movies" && (
        <FlatList
          data={favMovies}
          keyExtractor={(m) => m.streamId}
          contentContainerStyle={[styles.list, { paddingBottom: bottomPadding + 100 }]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.mediaRow, pressed && { opacity: 0.75 }]}
              onPress={() => {
                router.push({ pathname: "/movie/[id]", params: { id: item.streamId } });
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <View style={styles.mediaThumbnail}>
                {item.streamIcon ? (
                  <Image source={{ uri: item.streamIcon }} style={styles.mediaThumbnailImg} resizeMode="cover" />
                ) : (
                  <Ionicons name="film" size={24} color={Colors.textMuted} />
                )}
              </View>
              <View style={styles.mediaInfo}>
                <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.itemSub}>{item.year}{item.genre ? ` · ${item.genre}` : ""}</Text>
              </View>
              <Pressable onPress={() => { toggleFavorite("movies", item.streamId); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
                <Ionicons name="heart" size={20} color={Colors.danger} />
              </Pressable>
            </Pressable>
          )}
          ListEmptyComponent={<EmptyState type="movies" />}
        />
      )}

      {activeTab === "series" && (
        <FlatList
          data={favSeries}
          keyExtractor={(s) => s.seriesId}
          contentContainerStyle={[styles.list, { paddingBottom: bottomPadding + 100 }]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.mediaRow, pressed && { opacity: 0.75 }]}
              onPress={() => {
                router.push({ pathname: "/series-detail/[id]", params: { id: item.seriesId } });
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <View style={styles.mediaThumbnail}>
                {item.cover ? (
                  <Image source={{ uri: item.cover }} style={styles.mediaThumbnailImg} resizeMode="cover" />
                ) : (
                  <Ionicons name="play-circle" size={24} color={Colors.textMuted} />
                )}
              </View>
              <View style={styles.mediaInfo}>
                <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.itemSub}>{item.year}{item.genre ? ` · ${item.genre}` : ""}</Text>
              </View>
              <Pressable onPress={() => { toggleFavorite("series", item.seriesId); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
                <Ionicons name="heart" size={20} color={Colors.danger} />
              </Pressable>
            </Pressable>
          )}
          ListEmptyComponent={<EmptyState type="series" />}
        />
      )}
    </View>
  );
}

function EmptyState({ type }: { type: Tab }) {
  const messages = {
    channels: "No favorite channels yet. Heart a channel in Live TV.",
    movies: "No favorite movies yet. Heart a movie in Movies.",
    series: "No favorite series yet. Heart a series in Series.",
  };
  const icons = { channels: "tv-outline", movies: "film-outline", series: "play-circle-outline" };
  return (
    <View style={styles.emptyState}>
      <Ionicons name={icons[type] as any} size={52} color={Colors.textMuted} />
      <Text style={styles.emptyText}>{messages[type]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  tabsRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 6,
  },
  tabActive: {
    backgroundColor: Colors.accentSoft,
    borderColor: Colors.accent,
  },
  tabText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.accent,
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeActive: {
    backgroundColor: Colors.accent,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: Colors.textMuted,
  },
  badgeTextActive: {
    color: "#fff",
  },
  list: {
    paddingHorizontal: 20,
    gap: 6,
  },
  channelRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: 6,
  },
  channelLogo: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  mediaRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: 6,
  },
  mediaThumbnail: {
    width: 52,
    height: 70,
    borderRadius: 8,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  mediaThumbnailImg: {
    width: "100%",
    height: "100%",
  },
  mediaInfo: {
    flex: 1,
    gap: 4,
  },
  itemName: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  itemSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 14,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
    maxWidth: 240,
    lineHeight: 20,
  },
});
