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
  useWindowDimensions,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useIPTV, Channel } from "@/context/IPTVContext";
import Colors from "@/constants/colors";
import * as Haptics from "expo-haptics";

function getGridCols(w: number): number {
  if (w < 400) return 2;
  if (w < 600) return 3;
  if (w < 900) return 4;
  if (w < 1200) return 5;
  return 6;
}

function getCardSize(w: number, cols: number, sidebarVisible: boolean): number {
  const usableWidth = sidebarVisible ? w - 160 : w;
  const padding = 24;
  const gap = (cols - 1) * 10;
  return Math.floor((usableWidth - padding - gap) / cols);
}

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

function useNow() {
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

export default function LiveTVScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { channels, liveCategories, toggleFavorite, isFavorite, getStreamUrl, addToHistory } = useIPTV();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"name" | "favorites">("name");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const { time, date } = useNow();

  const isMobile = width < 700;
  const isTablet = width >= 700 && width < 1100;
  const sidebarVisible = !isMobile;

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
        return (isFavorite("channels", a.streamId) ? -1 : 1) - (isFavorite("channels", b.streamId) ? -1 : 1);
      });
    } else {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [channels, selectedCategory, search, sortBy, isFavorite]);

  const selectedLabel = allCategories.find((c) => c.categoryId === selectedCategory)?.categoryName || "All Channels";
  const numCols = getGridCols(width);
  const cardSize = getCardSize(width, numCols, sidebarVisible);

  const openChannel = (channel: Channel) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const url = channel.url || getStreamUrl("live", channel.streamId, "ts");
    addToHistory({ id: channel.streamId, type: "channel", name: channel.name, thumbnail: channel.streamIcon, timestamp: Date.now(), url });
    router.push({ pathname: "/player", params: { url, title: channel.name, logo: channel.streamIcon, type: "live", streamId: channel.streamId } });
  };

  return (
    <View style={[styles.container, { paddingTop: topPadding, paddingLeft: leftPadding }]}>
      <View style={[styles.topBar, isMobile && styles.topBarMobile]}>
        <View style={styles.topBarLeft}>
          {!isMobile && (
            <View style={styles.timeBlock}>
              <Text style={styles.timeText}>{time}</Text>
              <Text style={styles.dateText}>{date}</Text>
            </View>
          )}
          <View style={styles.categoryLabel}>
            <Ionicons name="tv" size={12} color={Colors.accent} />
            <Text style={styles.categoryLabelText} numberOfLines={1}>{selectedLabel}</Text>
            {filtered.length > 0 && (
              <Text style={styles.channelCount}>{filtered.length}</Text>
            )}
          </View>
        </View>
        <View style={styles.topBarRight}>
          <View style={[styles.searchBox, isMobile && { minWidth: 120 }]}>
            <Ionicons name="search" size={15} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder={isMobile ? "Search..." : "Search channels..."}
              placeholderTextColor={Colors.textMuted}
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch("")}>
                <Ionicons name="close-circle" size={15} color={Colors.textMuted} />
              </Pressable>
            )}
          </View>
          <Pressable
            style={[styles.iconBtn, sortBy === "favorites" && styles.iconBtnActive]}
            onPress={() => { setSortBy((s) => s === "name" ? "favorites" : "name"); Haptics.selectionAsync(); }}
          >
            <Ionicons name={sortBy === "favorites" ? "heart" : "heart-outline"} size={16} color={sortBy === "favorites" ? Colors.danger : Colors.textMuted} />
          </Pressable>
          <Pressable
            style={styles.iconBtn}
            onPress={() => { setViewMode((v) => v === "grid" ? "list" : "grid"); Haptics.selectionAsync(); }}
          >
            <Ionicons name={viewMode === "grid" ? "list" : "grid"} size={16} color={Colors.textMuted} />
          </Pressable>
          {!isMobile && (
            <Pressable style={styles.iconBtn} onPress={() => { router.push("/epg"); Haptics.selectionAsync(); }}>
              <Ionicons name="calendar-outline" size={16} color={Colors.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      {isMobile && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.mobileCategoryBar}
        >
          {allCategories.map((item) => {
            const isActive = selectedCategory === item.categoryId;
            return (
              <Pressable
                key={item.categoryId}
                style={[styles.mobileCategoryChip, isActive && styles.mobileCategoryChipActive]}
                onPress={() => { setSelectedCategory(item.categoryId); Haptics.selectionAsync(); }}
              >
                <Text style={[styles.mobileCategoryText, isActive && styles.mobileCategoryTextActive]} numberOfLines={1}>
                  {item.categoryName}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      <View style={styles.mainLayout}>
        {sidebarVisible && (
          <View style={styles.sidebar}>
            <FlatList
              data={allCategories}
              keyExtractor={(c) => c.categoryId}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.sidebarList}
              renderItem={({ item }) => {
                const isActive = selectedCategory === item.categoryId;
                return (
                  <Pressable
                    style={[styles.sidebarItem, isActive && styles.sidebarItemActive]}
                    onPress={() => { setSelectedCategory(item.categoryId); Haptics.selectionAsync(); }}
                  >
                    {isActive && <View style={styles.sidebarActiveBar} />}
                    <Ionicons
                      name={item.categoryId === "favorites" ? (isActive ? "heart" : "heart-outline") : isActive ? "folder" : "folder-outline"}
                      size={13}
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
        )}

        <View style={styles.contentArea}>
          {channels.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="tv-outline" size={52} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No Channels</Text>
              <Text style={styles.emptySubtitle}>Connect a playlist to see channels</Text>
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={36} color={Colors.textMuted} />
              <Text style={styles.emptySubtitle}>No channels match your search</Text>
            </View>
          ) : viewMode === "grid" ? (
            <FlatList
              key={`grid-${numCols}`}
              data={filtered}
              keyExtractor={(c) => c.streamId}
              numColumns={numCols}
              contentContainerStyle={[styles.gridList, { paddingBottom: bottomPadding + 80 }]}
              columnWrapperStyle={styles.gridRow}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <ChannelGridCard
                  channel={item}
                  cardSize={cardSize}
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
              contentContainerStyle={[styles.listContent, { paddingBottom: bottomPadding + 80 }]}
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

function ChannelGridCard({ channel, cardSize, onPress, isFav, onToggleFav }: {
  channel: Channel; cardSize: number; onPress: () => void; isFav: boolean; onToggleFav: () => void;
}) {
  const quality = getQualityTag(channel.name);
  const qColor = quality ? getQualityColor(quality) : Colors.textMuted;
  const logoSize = Math.max(32, Math.min(cardSize * 0.55, 64));
  const fontSize = cardSize < 90 ? 9 : 11;

  return (
    <Pressable style={({ pressed }) => [styles.gridCard, { width: cardSize }, pressed && styles.cardPressed]} onPress={onPress}>
      <View style={[styles.gridCardLogo, { width: logoSize + 16, height: logoSize }]}>
        {channel.streamIcon ? (
          <Image source={{ uri: channel.streamIcon }} style={{ width: logoSize, height: logoSize - 4 }} resizeMode="contain" />
        ) : (
          <Ionicons name="tv" size={logoSize * 0.6} color={Colors.textMuted} />
        )}
        {quality && (
          <View style={[styles.qualityBadge, { backgroundColor: qColor + "28", borderColor: qColor + "60" }]}>
            <Text style={[styles.qualityText, { color: qColor }]}>{quality}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.gridCardName, { fontSize }]} numberOfLines={2}>{channel.name}</Text>
      <View style={styles.gridCardActions}>
        <Pressable style={styles.favBtnSmall} onPress={onToggleFav} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Ionicons name={isFav ? "heart" : "heart-outline"} size={12} color={isFav ? Colors.danger : Colors.textMuted} />
        </Pressable>
        <Pressable style={styles.playBtnSmall} onPress={onPress}>
          <Ionicons name="play" size={10} color="#fff" />
        </Pressable>
      </View>
    </Pressable>
  );
}

function ChannelListRow({ channel, onPress, isFav, onToggleFav }: {
  channel: Channel; onPress: () => void; isFav: boolean; onToggleFav: () => void;
}) {
  const quality = getQualityTag(channel.name);
  const qColor = quality ? getQualityColor(quality) : Colors.textMuted;

  return (
    <Pressable style={({ pressed }) => [styles.listRow, pressed && styles.cardPressed]} onPress={onPress}>
      <View style={styles.listLogo}>
        {channel.streamIcon ? (
          <Image source={{ uri: channel.streamIcon }} style={styles.listLogoImg} resizeMode="contain" />
        ) : (
          <Ionicons name="tv" size={20} color={Colors.textMuted} />
        )}
      </View>
      <View style={styles.listInfo}>
        <Text style={styles.listName} numberOfLines={1}>{channel.name}</Text>
        {channel.epgChannelId ? <Text style={styles.listEpg} numberOfLines={1}>{channel.epgChannelId}</Text> : null}
      </View>
      {quality && (
        <View style={[styles.qualityBadgeInline, { backgroundColor: qColor + "28", borderColor: qColor + "60" }]}>
          <Text style={[styles.qualityText, { color: qColor }]}>{quality}</Text>
        </View>
      )}
      <Pressable style={styles.favBtn} onPress={onToggleFav} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name={isFav ? "heart" : "heart-outline"} size={18} color={isFav ? Colors.danger : Colors.textMuted} />
      </Pressable>
      <View style={styles.playBtn}>
        <Ionicons name="play" size={14} color="#fff" />
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
    flexWrap: "wrap",
    gap: 8,
  },
  topBarMobile: { paddingVertical: 6 },
  topBarLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  topBarRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  timeBlock: { gap: 1 },
  timeText: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.text },
  dateText: { fontSize: 9, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  categoryLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.card,
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    maxWidth: 200,
  },
  categoryLabelText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.text, flexShrink: 1 },
  channelCount: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: Colors.accent,
    backgroundColor: Colors.accentSoft,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    borderRadius: 9,
    paddingHorizontal: 9,
    height: 34,
    gap: 5,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    minWidth: 160,
  },
  searchInput: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.text },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  iconBtnActive: { borderColor: Colors.danger, backgroundColor: Colors.danger + "18" },
  mobileCategoryBar: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  mobileCategoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  mobileCategoryChipActive: {
    backgroundColor: Colors.accentSoft,
    borderColor: Colors.accent,
  },
  mobileCategoryText: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.textMuted },
  mobileCategoryTextActive: { color: Colors.accent },
  mainLayout: { flex: 1, flexDirection: "row" },
  sidebar: {
    width: 160,
    backgroundColor: Colors.surface,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  sidebarList: { paddingVertical: 6 },
  sidebarItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 7,
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
  sidebarLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.textMuted, flex: 1 },
  sidebarLabelActive: { color: Colors.text, fontFamily: "Inter_600SemiBold" },
  contentArea: { flex: 1 },
  gridList: { padding: 12 },
  gridRow: { gap: 10, marginBottom: 10, justifyContent: "flex-start" },
  gridCard: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 5,
  },
  cardPressed: { opacity: 0.75, transform: [{ scale: 0.96 }] },
  gridCardLogo: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  gridCardName: { fontFamily: "Inter_500Medium", color: Colors.text, textAlign: "center", lineHeight: 14 },
  gridCardActions: { flexDirection: "row", gap: 6, alignItems: "center" },
  favBtnSmall: { padding: 2 },
  playBtnSmall: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  qualityBadge: {
    position: "absolute",
    bottom: -3,
    right: -3,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderWidth: 1,
  },
  qualityBadgeInline: {
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
  },
  qualityText: { fontSize: 8, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  listContent: { padding: 10, gap: 6 },
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
    width: 46,
    height: 34,
    borderRadius: 7,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  listLogoImg: { width: 40, height: 30 },
  listInfo: { flex: 1 },
  listName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.text },
  listEpg: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 1 },
  favBtn: { padding: 4 },
  playBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: Colors.text },
  emptySubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textMuted, textAlign: "center" },
});
