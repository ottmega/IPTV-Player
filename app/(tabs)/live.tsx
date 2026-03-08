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
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useIPTV, Channel } from "@/context/IPTVContext";
import Colors from "@/constants/colors";
import * as Haptics from "expo-haptics";

const { width } = Dimensions.get("window");

const CARD_SIZE = 110;
const SIDEBAR_WIDTH = 160;

function getQualityTag(name: string): string | null {
  const upper = name.toUpperCase();
  if (upper.includes("4K") || upper.includes("UHD")) return "4K";
  if (upper.includes("FHD") || upper.includes("1080")) return "FHD";
  if (upper.includes("HD") || upper.includes("720")) return "HD";
  if (upper.includes("SD")) return "SD";
  return "HD";
}

function getQualityColor(tag: string): string {
  if (tag === "4K") return "#A855F7";
  if (tag === "FHD") return "#3B82F6";
  if (tag === "HD") return "#10B981";
  return Colors.textMuted;
}

function getNow() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ampm = now.getHours() >= 12 ? "PM" : "AM";
  const h = now.getHours() % 12 || 12;
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return {
    time: `${String(h).padStart(2, "0")}:${mm} ${ampm}`,
    date: `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`,
  };
}

export default function LiveTVScreen() {
  const insets = useSafeAreaInsets();
  const { channels, liveCategories, toggleFavorite, isFavorite, getStreamUrl, addToHistory, favorites } = useIPTV();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"name" | "favorites">("name");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const { time, date } = getNow();

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;
  const leftPadding = Platform.OS === "web" ? 0 : insets.left;

  const allCategories = useMemo(
    () => [
      { categoryId: "all", categoryName: "All Channels" },
      { categoryId: "favorites", categoryName: "Favorites" },
      ...liveCategories,
    ],
    [liveCategories]
  );

  const filtered = useMemo(() => {
    let list = channels;
    if (selectedCategory === "favorites") {
      list = list.filter((c) => isFavorite("channels", c.streamId));
    } else if (selectedCategory !== "all") {
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

  const selectedCategoryLabel = allCategories.find((c) => c.categoryId === selectedCategory)?.categoryName || "All Channels";

  const openChannel = (channel: Channel) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const url = channel.url || getStreamUrl("live", channel.streamId, "ts");
    addToHistory({ id: channel.streamId, type: "channel", name: channel.name, thumbnail: channel.streamIcon, timestamp: Date.now(), url });
    router.push({ pathname: "/player", params: { url, title: channel.name, logo: channel.streamIcon, type: "live", streamId: channel.streamId } });
  };

  const numColumns = viewMode === "grid" ? Math.max(2, Math.floor((width - SIDEBAR_WIDTH - leftPadding - 32) / (CARD_SIZE + 12))) : 1;

  return (
    <View style={[styles.container, { paddingTop: topPadding, paddingLeft: leftPadding }]}>
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <View style={styles.timeBlock}>
            <Text style={styles.timeText}>{time}</Text>
            <Text style={styles.dateText}>{date}</Text>
          </View>
          <View style={styles.categoryLabel}>
            <Ionicons name="tv" size={14} color={Colors.accent} />
            <Text style={styles.categoryLabelText}>{selectedCategoryLabel}</Text>
            {filtered.length > 0 && <Text style={styles.channelCount}>{filtered.length}</Text>}
          </View>
        </View>
        <View style={styles.topBarRight}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color={Colors.textMuted} />
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
                <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
              </Pressable>
            )}
          </View>
          <Pressable
            style={[styles.iconBtn, sortBy === "favorites" && styles.iconBtnActive]}
            onPress={() => { setSortBy((s) => s === "name" ? "favorites" : "name"); Haptics.selectionAsync(); }}
          >
            <Ionicons name={sortBy === "favorites" ? "heart" : "heart-outline"} size={18} color={sortBy === "favorites" ? Colors.danger : Colors.textMuted} />
          </Pressable>
          <Pressable
            style={styles.iconBtn}
            onPress={() => { setViewMode((v) => v === "grid" ? "list" : "grid"); Haptics.selectionAsync(); }}
          >
            <Ionicons name={viewMode === "grid" ? "list" : "grid"} size={18} color={Colors.textMuted} />
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={() => { router.push("/epg"); Haptics.selectionAsync(); }}>
            <Ionicons name="calendar-outline" size={18} color={Colors.textMuted} />
          </Pressable>
        </View>
      </View>

      <View style={styles.mainLayout}>
        <View style={styles.sidebar}>
          <FlatList
            data={allCategories}
            keyExtractor={(c) => c.categoryId}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sidebarList}
            renderItem={({ item }) => {
              const isActive = selectedCategory === item.categoryId;
              const isFav = item.categoryId === "favorites";
              return (
                <Pressable
                  style={[styles.sidebarItem, isActive && styles.sidebarItemActive]}
                  onPress={() => { setSelectedCategory(item.categoryId); Haptics.selectionAsync(); }}
                >
                  {isActive && <View style={styles.sidebarActiveBar} />}
                  <Ionicons
                    name={isFav ? (isActive ? "heart" : "heart-outline") : isActive ? "folder" : "folder-outline"}
                    size={14}
                    color={isActive ? Colors.accent : Colors.textMuted}
                  />
                  <Text style={[styles.sidebarLabel, isActive && styles.sidebarLabelActive]} numberOfLines={1}>
                    {item.categoryName}
                  </Text>
                </Pressable>
              );
            }}
          />
        </View>

        <View style={styles.contentArea}>
          {channels.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="tv-outline" size={56} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No Channels</Text>
              <Text style={styles.emptySubtitle}>Connect a playlist to see channels</Text>
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={40} color={Colors.textMuted} />
              <Text style={styles.emptySubtitle}>No channels match your search</Text>
            </View>
          ) : viewMode === "grid" ? (
            <FlatList
              key={`grid-${numColumns}`}
              data={filtered}
              keyExtractor={(c) => c.streamId}
              numColumns={numColumns}
              contentContainerStyle={[styles.gridList, { paddingBottom: bottomPadding + 100 }]}
              columnWrapperStyle={numColumns > 1 ? styles.gridRow : undefined}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <ChannelGridCard
                  channel={item}
                  onPress={() => openChannel(item)}
                  isFav={isFavorite("channels", item.streamId)}
                  onToggleFav={() => { toggleFavorite("channels", item.streamId); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                />
              )}
            />
          ) : (
            <FlatList
              key="list"
              data={filtered}
              keyExtractor={(c) => c.streamId}
              contentContainerStyle={[styles.listContent, { paddingBottom: bottomPadding + 100 }]}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <ChannelListRow
                  channel={item}
                  onPress={() => openChannel(item)}
                  isFav={isFavorite("channels", item.streamId)}
                  onToggleFav={() => { toggleFavorite("channels", item.streamId); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                />
              )}
            />
          )}
        </View>
      </View>
    </View>
  );
}

function ChannelGridCard({ channel, onPress, isFav, onToggleFav }: { channel: Channel; onPress: () => void; isFav: boolean; onToggleFav: () => void }) {
  const quality = getQualityTag(channel.name);
  const qColor = quality ? getQualityColor(quality) : Colors.textMuted;

  return (
    <Pressable style={({ pressed }) => [styles.gridCard, pressed && styles.cardPressed]} onPress={onPress}>
      <View style={styles.gridCardLogo}>
        {channel.streamIcon ? (
          <Image source={{ uri: channel.streamIcon }} style={styles.gridCardLogoImg} resizeMode="contain" />
        ) : (
          <Ionicons name="tv" size={28} color={Colors.textMuted} />
        )}
        {quality && (
          <View style={[styles.qualityBadge, { backgroundColor: qColor + "28", borderColor: qColor + "60" }]}>
            <Text style={[styles.qualityText, { color: qColor }]}>{quality}</Text>
          </View>
        )}
      </View>
      <Text style={styles.gridCardName} numberOfLines={2}>{channel.name}</Text>
      <View style={styles.gridCardActions}>
        <Pressable
          style={styles.favBtnSmall}
          onPress={onToggleFav}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name={isFav ? "heart" : "heart-outline"} size={14} color={isFav ? Colors.danger : Colors.textMuted} />
        </Pressable>
        <Pressable style={styles.playBtnSmall} onPress={onPress}>
          <Ionicons name="play" size={12} color="#fff" />
        </Pressable>
      </View>
    </Pressable>
  );
}

function ChannelListRow({ channel, onPress, isFav, onToggleFav }: { channel: Channel; onPress: () => void; isFav: boolean; onToggleFav: () => void }) {
  const quality = getQualityTag(channel.name);
  const qColor = quality ? getQualityColor(quality) : Colors.textMuted;

  return (
    <Pressable style={({ pressed }) => [styles.listRow, pressed && styles.cardPressed]} onPress={onPress}>
      <View style={styles.listLogo}>
        {channel.streamIcon ? (
          <Image source={{ uri: channel.streamIcon }} style={styles.listLogoImg} resizeMode="contain" />
        ) : (
          <Ionicons name="tv" size={22} color={Colors.textMuted} />
        )}
      </View>
      <View style={styles.listInfo}>
        <Text style={styles.listName} numberOfLines={1}>{channel.name}</Text>
        {channel.epgChannelId ? <Text style={styles.listEpg} numberOfLines={1}>{channel.epgChannelId}</Text> : null}
      </View>
      {quality && (
        <View style={[styles.qualityBadge, { backgroundColor: qColor + "28", borderColor: qColor + "60" }]}>
          <Text style={[styles.qualityText, { color: qColor }]}>{quality}</Text>
        </View>
      )}
      <Pressable style={styles.favBtn} onPress={onToggleFav} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name={isFav ? "heart" : "heart-outline"} size={20} color={isFav ? Colors.danger : Colors.textMuted} />
      </Pressable>
      <View style={styles.playBtn}>
        <Ionicons name="play" size={16} color="#fff" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  topBarLeft: { flexDirection: "row", alignItems: "center", gap: 20 },
  topBarRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  timeBlock: { gap: 1 },
  timeText: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.text },
  dateText: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  categoryLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.card,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  categoryLabelText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.text },
  channelCount: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: Colors.accent,
    backgroundColor: Colors.accentSoft,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 36,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    minWidth: 180,
  },
  searchInput: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.text },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  iconBtnActive: { borderColor: Colors.danger, backgroundColor: Colors.danger + "15" },
  mainLayout: { flex: 1, flexDirection: "row" },
  sidebar: {
    width: SIDEBAR_WIDTH,
    backgroundColor: Colors.surface,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  sidebarList: { paddingVertical: 8 },
  sidebarItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 8,
    position: "relative",
    overflow: "hidden",
  },
  sidebarItemActive: { backgroundColor: Colors.accentSoft },
  sidebarActiveBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: Colors.accent,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  sidebarLabel: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.textMuted, flex: 1 },
  sidebarLabelActive: { color: Colors.text, fontFamily: "Inter_600SemiBold" },
  contentArea: { flex: 1 },
  gridList: { padding: 12 },
  gridRow: { gap: 10, marginBottom: 10 },
  gridCard: {
    width: CARD_SIZE,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 6,
  },
  cardPressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
  gridCardLogo: {
    width: 70,
    height: 50,
    borderRadius: 8,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
    position: "relative",
  },
  gridCardLogoImg: { width: 60, height: 40 },
  gridCardName: { fontSize: 10, fontFamily: "Inter_500Medium", color: Colors.text, textAlign: "center", lineHeight: 13 },
  gridCardActions: { flexDirection: "row", gap: 6, alignItems: "center" },
  favBtnSmall: { padding: 2 },
  playBtnSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: { padding: 12, gap: 6 },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  listLogo: {
    width: 48,
    height: 36,
    borderRadius: 8,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  listLogoImg: { width: 44, height: 32 },
  listInfo: { flex: 1 },
  listName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.text },
  listEpg: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 2 },
  qualityBadge: {
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    position: "absolute",
    bottom: -4,
    right: -4,
  },
  qualityText: { fontSize: 8, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  favBtn: { padding: 4 },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingVertical: 60 },
  emptyTitle: { fontSize: 20, fontFamily: "Inter_600SemiBold", color: Colors.text },
  emptySubtitle: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textMuted, textAlign: "center" },
});
