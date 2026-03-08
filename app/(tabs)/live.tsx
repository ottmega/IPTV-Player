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
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useIPTV, Channel } from "@/context/IPTVContext";
import Colors from "@/constants/colors";
import * as Haptics from "expo-haptics";

export default function LiveTVScreen() {
  const insets = useSafeAreaInsets();
  const { channels, liveCategories, toggleFavorite, isFavorite, getStreamUrl, addToHistory, loginType } = useIPTV();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"name" | "favorites">("name");

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : 0;

  const allCategories = useMemo(
    () => [{ categoryId: "all", categoryName: "All" }, ...liveCategories],
    [liveCategories]
  );

  const filtered = useMemo(() => {
    let list = channels;
    if (selectedCategory !== "all") {
      list = list.filter((c) => c.categoryId === selectedCategory);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q));
    }
    if (sortBy === "favorites") {
      list = [...list].sort((a, b) => {
        const af = isFavorite("channels", a.streamId) ? -1 : 1;
        const bf = isFavorite("channels", b.streamId) ? -1 : 1;
        return af - bf;
      });
    } else {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [channels, selectedCategory, search, sortBy, isFavorite]);

  const openChannel = (channel: Channel) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const url = channel.url || getStreamUrl("live", channel.streamId, "ts");
    addToHistory({
      id: channel.streamId,
      type: "channel",
      name: channel.name,
      thumbnail: channel.streamIcon,
      timestamp: Date.now(),
      url,
    });
    router.push({
      pathname: "/player",
      params: { url, title: channel.name, logo: channel.streamIcon, type: "live" },
    });
  };

  const openEPG = () => {
    Haptics.selectionAsync();
    router.push("/epg");
  };

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Live TV</Text>
        <View style={styles.headerActions}>
          <Pressable style={styles.headerBtn} onPress={openEPG}>
            <Ionicons name="calendar-outline" size={22} color={Colors.text} />
          </Pressable>
          <Pressable
            style={styles.headerBtn}
            onPress={() => { router.push("/multiscreen"); Haptics.selectionAsync(); }}
          >
            <Ionicons name="grid-outline" size={22} color={Colors.text} />
          </Pressable>
        </View>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={17} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search channels..."
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={17} color={Colors.textMuted} />
            </Pressable>
          )}
        </View>
        <Pressable
          style={[styles.sortBtn, sortBy === "favorites" && styles.sortBtnActive]}
          onPress={() => { setSortBy((s) => s === "name" ? "favorites" : "name"); Haptics.selectionAsync(); }}
        >
          <Ionicons
            name={sortBy === "favorites" ? "heart" : "heart-outline"}
            size={18}
            color={sortBy === "favorites" ? Colors.danger : Colors.textMuted}
          />
        </Pressable>
      </View>

      <FlatList
        horizontal
        data={allCategories}
        keyExtractor={(c) => c.categoryId}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryList}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.categoryChip, selectedCategory === item.categoryId && styles.categoryChipActive]}
            onPress={() => { setSelectedCategory(item.categoryId); Haptics.selectionAsync(); }}
          >
            <Text
              style={[styles.categoryChipText, selectedCategory === item.categoryId && styles.categoryChipTextActive]}
              numberOfLines={1}
            >
              {item.categoryName}
            </Text>
          </Pressable>
        )}
      />

      {channels.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="tv-outline" size={56} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No Channels</Text>
          <Text style={styles.emptySubtitle}>Connect a playlist to see channels</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.streamId}
          contentContainerStyle={[styles.list, { paddingBottom: bottomPadding + 100 }]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <ChannelRow
              channel={item}
              onPress={() => openChannel(item)}
              isFav={isFavorite("channels", item.streamId)}
              onToggleFav={() => { toggleFavorite("channels", item.streamId); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptySubtitle}>No channels match your search</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

function ChannelRow({
  channel,
  onPress,
  isFav,
  onToggleFav,
}: {
  channel: Channel;
  onPress: () => void;
  isFav: boolean;
  onToggleFav: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.channelRow, pressed && styles.channelRowPressed]}
      onPress={onPress}
    >
      <View style={styles.channelLogo}>
        {channel.streamIcon ? (
          <Image
            source={{ uri: channel.streamIcon }}
            style={styles.channelLogoImg}
            resizeMode="contain"
          />
        ) : (
          <Ionicons name="tv" size={22} color={Colors.textMuted} />
        )}
      </View>
      <View style={styles.channelInfo}>
        <Text style={styles.channelName} numberOfLines={1}>{channel.name}</Text>
        {channel.epgChannelId ? (
          <Text style={styles.channelEpg} numberOfLines={1}>{channel.epgChannelId}</Text>
        ) : null}
      </View>
      <Pressable
        style={styles.favBtn}
        onPress={onToggleFav}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons
          name={isFav ? "heart" : "heart-outline"}
          size={20}
          color={isFav ? Colors.danger : Colors.textMuted}
        />
      </Pressable>
      <Ionicons name="play-circle-outline" size={24} color={Colors.accent} style={{ marginLeft: 8 }} />
    </Pressable>
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
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  searchRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 12,
    alignItems: "center",
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
  },
  sortBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  sortBtnActive: {
    borderColor: Colors.danger,
    backgroundColor: Colors.danger + "15",
  },
  categoryList: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  categoryChipActive: {
    backgroundColor: Colors.accentSoft,
    borderColor: Colors.accent,
  },
  categoryChipText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  categoryChipTextActive: {
    color: Colors.accent,
  },
  list: {
    paddingHorizontal: 20,
    gap: 2,
  },
  channelRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  channelRowPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.99 }],
  },
  channelLogo: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    overflow: "hidden",
  },
  channelLogoImg: {
    width: 36,
    height: 36,
  },
  channelInfo: {
    flex: 1,
  },
  channelName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  channelEpg: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    marginTop: 2,
  },
  favBtn: {
    padding: 4,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
  },
});
