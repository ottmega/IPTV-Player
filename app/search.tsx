import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
  TextInput,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useIPTV } from "@/context/IPTVContext";
import Colors from "@/constants/colors";
import * as Haptics from "expo-haptics";

type ResultType = "channel" | "movie" | "series";

interface SearchResult {
  id: string;
  type: ResultType;
  name: string;
  thumbnail: string;
  subtitle?: string;
}

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const { channels, movies, series, getStreamUrl, addToHistory } = useIPTV();
  const [query, setQuery] = useState("");

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  const results = useMemo<SearchResult[]>(() => {
    if (query.trim().length < 2) return [];
    const q = query.toLowerCase();
    const r: SearchResult[] = [];

    channels
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 20)
      .forEach((c) =>
        r.push({ id: c.streamId, type: "channel", name: c.name, thumbnail: c.streamIcon })
      );

    movies
      .filter((m) => m.name.toLowerCase().includes(q))
      .slice(0, 10)
      .forEach((m) =>
        r.push({
          id: m.streamId,
          type: "movie",
          name: m.name,
          thumbnail: m.streamIcon,
          subtitle: [m.year, m.genre].filter(Boolean).join(" · "),
        })
      );

    series
      .filter((s) => s.name.toLowerCase().includes(q))
      .slice(0, 10)
      .forEach((s) =>
        r.push({
          id: s.seriesId,
          type: "series",
          name: s.name,
          thumbnail: s.cover,
          subtitle: [s.year, s.genre].filter(Boolean).join(" · "),
        })
      );

    return r;
  }, [query, channels, movies, series]);

  const handlePress = (item: SearchResult) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (item.type === "channel") {
      const channel = channels.find((c) => c.streamId === item.id);
      const url = channel?.url || getStreamUrl("live", item.id);
      addToHistory({ id: item.id, type: "channel", name: item.name, thumbnail: item.thumbnail, timestamp: Date.now(), url });
      router.push({ pathname: "/player", params: { url, title: item.name, type: "live", streamId: item.id } });
    } else if (item.type === "movie") {
      router.push({ pathname: "/movie/[id]", params: { id: item.id } });
    } else {
      router.push({ pathname: "/series-detail/[id]", params: { id: item.id } });
    }
  };

  const typeIcon = (type: ResultType) => {
    if (type === "channel") return "tv-outline";
    if (type === "movie") return "film-outline";
    return "play-circle-outline";
  };

  const typeColor = (type: ResultType) => {
    if (type === "channel") return Colors.accent;
    if (type === "movie") return Colors.gradient2;
    return Colors.success;
  };

  const typeLabel = (type: ResultType) => {
    if (type === "channel") return "Channel";
    if (type === "movie") return "Movie";
    return "Series";
  };

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search channels, movies, series..."
            placeholderTextColor={Colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoFocus
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")}>
              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      {query.trim().length < 2 && (
        <View style={styles.hintState}>
          <Ionicons name="search-outline" size={52} color={Colors.textMuted} />
          <Text style={styles.hintText}>Search across all your content</Text>
          <Text style={styles.hintSub}>Channels, movies, and series</Text>
        </View>
      )}

      {query.trim().length >= 2 && results.length === 0 && (
        <View style={styles.hintState}>
          <Ionicons name="sad-outline" size={52} color={Colors.textMuted} />
          <Text style={styles.hintText}>No results for "{query}"</Text>
          <Text style={styles.hintSub}>Try a different search term</Text>
        </View>
      )}

      {results.length > 0 && (
        <FlatList
          data={results}
          keyExtractor={(r) => `${r.type}-${r.id}`}
          contentContainerStyle={[styles.list, { paddingBottom: bottomPadding + 100 }]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.resultRow, pressed && { opacity: 0.75 }]}
              onPress={() => handlePress(item)}
            >
              <View style={styles.resultThumb}>
                {item.thumbnail ? (
                  <Image source={{ uri: item.thumbnail }} style={styles.resultThumbImg} resizeMode="cover" />
                ) : (
                  <Ionicons name={typeIcon(item.type) as any} size={22} color={Colors.textMuted} />
                )}
              </View>
              <View style={styles.resultInfo}>
                <Text style={styles.resultName} numberOfLines={1}>{item.name}</Text>
                {item.subtitle ? (
                  <Text style={styles.resultSub} numberOfLines={1}>{item.subtitle}</Text>
                ) : null}
              </View>
              <View style={[styles.typeBadge, { backgroundColor: typeColor(item.type) + "22" }]}>
                <Ionicons name={typeIcon(item.type) as any} size={12} color={typeColor(item.type)} />
                <Text style={[styles.typeText, { color: typeColor(item.type) }]}>
                  {typeLabel(item.type)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            </Pressable>
          )}
        />
      )}
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
    paddingBottom: 16,
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
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
  },
  hintState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 40,
  },
  hintText: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    textAlign: "center",
  },
  hintSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
  },
  list: {
    paddingHorizontal: 20,
    gap: 6,
  },
  resultRow: {
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
  resultThumb: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  resultThumbImg: {
    width: "100%",
    height: "100%",
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  resultSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    marginTop: 3,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  typeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
});
