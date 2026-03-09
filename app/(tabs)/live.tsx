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
  ActivityIndicator,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useIPTV, Channel } from "@/context/IPTVContext";
import Colors from "@/constants/colors";
import * as Haptics from "expo-haptics";

const SIDEBAR_W = 200;
const CARD_GAP = 6;
const GRID_PADDING = 8;

function getGridCols(contentW: number, isPortrait: boolean): number {
  if (isPortrait) {
    if (contentW < 300) return 2;
    if (contentW < 460) return 3;
    if (contentW < 600) return 4;
    return 5;
  }
  if (contentW < 380) return 3;
  if (contentW < 520) return 4;
  if (contentW < 700) return 5;
  if (contentW < 900) return 6;
  return 7;
}

function computeGrid(contentW: number, isPortrait: boolean) {
  const cols = getGridCols(contentW, isPortrait);
  const cardSize = Math.floor((contentW - GRID_PADDING * 2 - CARD_GAP * (cols - 1)) / cols);
  return { cols, cardSize };
}

export default function LiveTVScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { channels, liveCategories, toggleFavorite, isFavorite, getStreamUrl, addToHistory, loading, loginType } = useIPTV();
  const [search, setSearch] = useState("");
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"name" | "favorites">("name");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  const isPortrait = height > width;
  const isWeb = Platform.OS === "web";
  const isMobile = width < 680;
  const sidebarVisible = !isMobile;

  const topPadding = isWeb ? 67 : insets.top;
  const bottomPadding = isWeb ? 34 : insets.bottom;
  const leftPadding = isWeb ? 0 : insets.left;
  const rightPadding = isWeb ? 0 : insets.right;

  const contentWidth = width - leftPadding - rightPadding - (sidebarVisible ? SIDEBAR_W : 0);
  const { cols: numCols, cardSize } = computeGrid(contentWidth, isPortrait);

  const channelCountByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const ch of channels) {
      if (ch.categoryId) map[ch.categoryId] = (map[ch.categoryId] || 0) + 1;
    }
    return map;
  }, [channels]);

  const allCategories = useMemo(
    () => [
      { categoryId: "all", categoryName: "All Channels" },
      { categoryId: "favorites", categoryName: "Favorites" },
      ...liveCategories,
    ],
    [liveCategories]
  );

  const filteredSidebarCategories = useMemo(() => {
    if (!sidebarSearch.trim()) return allCategories;
    const q = sidebarSearch.toLowerCase();
    return allCategories.filter((c) => c.categoryName.toLowerCase().includes(q));
  }, [allCategories, sidebarSearch]);

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
      list = [...list].sort((a, b) =>
        (isFavorite("channels", a.streamId) ? -1 : 1) - (isFavorite("channels", b.streamId) ? -1 : 1)
      );
    } else {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [channels, selectedCategory, search, sortBy, isFavorite]);

  const selectedLabel = allCategories.find((c) => c.categoryId === selectedCategory)?.categoryName || "All Channels";

  const openChannel = (channel: Channel) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const url = channel.url || getStreamUrl("live", channel.streamId, "ts");
    addToHistory({ id: channel.streamId, type: "channel", name: channel.name, thumbnail: channel.streamIcon, timestamp: Date.now(), url });
    router.push({ pathname: "/player", params: { url, title: channel.name, logo: channel.streamIcon, type: "live", streamId: channel.streamId } });
  };

  const selectCategory = (id: string) => {
    setSelectedCategory(id);
    setShowCategoryModal(false);
    Haptics.selectionAsync();
  };

  return (
    <View style={[styles.container, { paddingTop: topPadding, paddingLeft: leftPadding, paddingRight: rightPadding }]}>
      {/* TOP BAR */}
      <View style={styles.topBar}>
        {/* Left actions */}
        <View style={styles.topBarSide}>
          <Pressable style={styles.topIconBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={Colors.text} />
          </Pressable>
          <Pressable
            style={[styles.topIconBtn, sortBy === "favorites" && { borderColor: "#E53E3E" }]}
            onPress={() => { setSortBy((s) => s === "name" ? "favorites" : "name"); Haptics.selectionAsync(); }}
          >
            <Ionicons name={sortBy === "favorites" ? "heart" : "heart-outline"} size={18} color={sortBy === "favorites" ? "#E53E3E" : Colors.textMuted} />
          </Pressable>
        </View>

        {/* Center: category selector */}
        <Pressable style={styles.topBarCenter} onPress={() => { if (isMobile) { setShowCategoryModal(true); Haptics.selectionAsync(); } }}>
          <Text style={styles.topBarCategoryText} numberOfLines={1}>{selectedLabel.toUpperCase()}</Text>
          {isMobile && <Ionicons name="chevron-down" size={14} color={Colors.textSecondary} style={{ marginLeft: 4 }} />}
          {filtered.length > 0 && (
            <View style={styles.topBarCountBadge}>
              <Text style={styles.topBarCountText}>{filtered.length}</Text>
            </View>
          )}
        </Pressable>

        {/* Right actions */}
        <View style={styles.topBarSide}>
          <Pressable style={styles.topIconBtn} onPress={() => { setViewMode((v) => v === "grid" ? "list" : "grid"); Haptics.selectionAsync(); }}>
            <Ionicons name={viewMode === "grid" ? "list" : "grid"} size={18} color={Colors.textMuted} />
          </Pressable>
          {!isMobile && (
            <Pressable style={styles.topIconBtn} onPress={() => { router.push("/epg"); Haptics.selectionAsync(); }}>
              <Ionicons name="calendar-outline" size={18} color={Colors.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      {/* SEARCH BAR */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={15} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search channels..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
          </Pressable>
        )}
      </View>

      {/* MAIN LAYOUT */}
      <View style={styles.mainLayout}>
        {/* SIDEBAR */}
        {sidebarVisible && (
          <View style={[styles.sidebar, { width: SIDEBAR_W }]}>
            {/* Sidebar search */}
            <View style={styles.sidebarSearchWrap}>
              <Ionicons name="search" size={13} color={Colors.textMuted} />
              <TextInput
                style={styles.sidebarSearchInput}
                placeholder="Search categories..."
                placeholderTextColor={Colors.textMuted}
                value={sidebarSearch}
                onChangeText={setSidebarSearch}
                autoCapitalize="none"
              />
              {sidebarSearch.length > 0 && (
                <Pressable onPress={() => setSidebarSearch("")} hitSlop={6}>
                  <Ionicons name="close-circle" size={13} color={Colors.textMuted} />
                </Pressable>
              )}
            </View>

            <FlatList
              data={filteredSidebarCategories}
              keyExtractor={(c) => c.categoryId}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.sidebarList}
              renderItem={({ item, index }) => {
                const isActive = selectedCategory === item.categoryId;
                const count = item.categoryId === "all"
                  ? channels.length
                  : item.categoryId === "favorites"
                  ? channels.filter((ch) => isFavorite("channels", ch.streamId)).length
                  : (channelCountByCategory[item.categoryId] || 0);
                const displayIndex = item.categoryId === "all" ? null : item.categoryId === "favorites" ? null : index - 1;
                return (
                  <Pressable
                    style={[styles.sidebarItem, isActive && styles.sidebarItemActive]}
                    onPress={() => { setSelectedCategory(item.categoryId); Haptics.selectionAsync(); }}
                  >
                    {isActive && <View style={styles.sidebarActiveBar} />}
                    {displayIndex !== null && (
                      <Text style={[styles.sidebarNum, isActive && styles.sidebarNumActive]}>
                        {String(displayIndex).padStart(2, "0")}
                      </Text>
                    )}
                    <Text style={[styles.sidebarLabel, isActive && styles.sidebarLabelActive, displayIndex === null && { paddingLeft: 2 }]} numberOfLines={1}>
                      {item.categoryName}
                    </Text>
                    {count > 0 && (
                      <Text style={[styles.sidebarCount, isActive && styles.sidebarCountActive]}>
                        {count}
                      </Text>
                    )}
                  </Pressable>
                );
              }}
            />
          </View>
        )}

        {/* CHANNEL CONTENT */}
        <View style={styles.contentArea}>
          {channels.length === 0 && (loading || loginType) ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color={Colors.accent} />
              <Text style={styles.emptySubtitle}>Loading channels...</Text>
            </View>
          ) : channels.length === 0 ? (
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
              contentContainerStyle={[styles.gridList, { paddingBottom: bottomPadding + 90 }]}
              columnWrapperStyle={styles.gridRow}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <ChannelTile
                  channel={item}
                  size={cardSize}
                  isFav={isFavorite("channels", item.streamId)}
                  onPress={() => openChannel(item)}
                  onToggleFav={() => { toggleFavorite("channels", item.streamId); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                />
              )}
            />
          ) : (
            <FlatList
              key="list"
              data={filtered}
              keyExtractor={(c) => c.streamId}
              contentContainerStyle={[styles.listContent, { paddingBottom: bottomPadding + 90 }]}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <ChannelListRow
                  channel={item}
                  isFav={isFavorite("channels", item.streamId)}
                  onPress={() => openChannel(item)}
                  onToggleFav={() => { toggleFavorite("channels", item.streamId); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                />
              )}
            />
          )}
        </View>
      </View>

      {/* Mobile category modal */}
      <Modal visible={showCategoryModal} transparent animationType="slide" onRequestClose={() => setShowCategoryModal(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowCategoryModal(false)} />
          <View style={styles.categorySheet}>
            <View style={styles.categorySheetHandle} />
            <Text style={styles.categorySheetTitle}>Select Category</Text>
            <FlatList
              data={allCategories}
              keyExtractor={(c) => c.categoryId}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: bottomPadding + 20 }}
              renderItem={({ item, index }) => {
                const isActive = selectedCategory === item.categoryId;
                const count = item.categoryId === "all"
                  ? channels.length
                  : item.categoryId === "favorites"
                  ? channels.filter((ch) => isFavorite("channels", ch.streamId)).length
                  : (channelCountByCategory[item.categoryId] || 0);
                return (
                  <Pressable
                    style={[styles.sheetItem, isActive && styles.sheetItemActive]}
                    onPress={() => selectCategory(item.categoryId)}
                  >
                    <Text style={[styles.sheetItemText, isActive && styles.sheetItemTextActive]} numberOfLines={1}>
                      {item.categoryName}
                    </Text>
                    {count > 0 && (
                      <Text style={[styles.sheetItemCount, isActive && { color: "#E53E3E" }]}>{count}</Text>
                    )}
                    {isActive && <Ionicons name="checkmark" size={16} color="#E53E3E" style={{ marginLeft: 4 }} />}
                  </Pressable>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ChannelTile({ channel, size, isFav, onPress, onToggleFav }: {
  channel: Channel; size: number; isFav: boolean; onPress: () => void; onToggleFav: () => void;
}) {
  const logoSize = Math.round(size * 0.72);
  const fontSize = size < 80 ? 8 : size < 100 ? 9 : size < 130 ? 10 : 11;

  return (
    <Pressable
      style={({ pressed }) => [styles.tile, { width: size }, pressed && styles.tilePressed]}
      onPress={onPress}
    >
      {/* Logo box */}
      <View style={[styles.tileLogoBox, { width: size, height: size }]}>
        {channel.streamIcon ? (
          <Image
            source={{ uri: channel.streamIcon }}
            style={{ width: logoSize, height: logoSize }}
            resizeMode="contain"
          />
        ) : (
          <Ionicons name="tv" size={logoSize * 0.55} color={Colors.textMuted} />
        )}
        {/* Fav button */}
        {isFav && (
          <Pressable style={styles.tileFavBtn} onPress={onToggleFav} hitSlop={6}>
            <Ionicons name="heart" size={11} color="#E53E3E" />
          </Pressable>
        )}
      </View>
      {/* Name below the logo box */}
      <Text style={[styles.tileName, { fontSize, width: size }]} numberOfLines={2}>{channel.name}</Text>
    </Pressable>
  );
}

function ChannelListRow({ channel, isFav, onPress, onToggleFav }: {
  channel: Channel; isFav: boolean; onPress: () => void; onToggleFav: () => void;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.listRow, pressed && styles.tilePressed]} onPress={onPress}>
      <View style={styles.listLogoBox}>
        {channel.streamIcon ? (
          <Image source={{ uri: channel.streamIcon }} style={{ width: 48, height: 36 }} resizeMode="contain" />
        ) : (
          <Ionicons name="tv" size={22} color={Colors.textMuted} />
        )}
      </View>
      <View style={styles.listInfo}>
        <Text style={styles.listName} numberOfLines={1}>{channel.name}</Text>
        {channel.epgChannelId ? <Text style={styles.listEpg} numberOfLines={1}>{channel.epgChannelId}</Text> : null}
      </View>
      <Pressable onPress={onToggleFav} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name={isFav ? "heart" : "heart-outline"} size={18} color={isFav ? "#E53E3E" : Colors.textMuted} />
      </Pressable>
      <View style={styles.listPlayBtn}>
        <Ionicons name="play" size={14} color="#fff" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D0D0D" },

  /* TOP BAR */
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1E1E1E",
    backgroundColor: "#111111",
    minHeight: 50,
  },
  topBarSide: { flexDirection: "row", alignItems: "center", gap: 6, minWidth: 72 },
  topBarCenter: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  topBarCategoryText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    letterSpacing: 0.8,
    textAlign: "center",
    flexShrink: 1,
  },
  topBarCountBadge: {
    backgroundColor: "#E53E3E",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 24,
    alignItems: "center",
  },
  topBarCountText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#fff" },
  topIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#1A1A1A",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#282828",
  },

  /* SEARCH BAR */
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#161616",
    borderBottomWidth: 1,
    borderBottomColor: "#1E1E1E",
    paddingHorizontal: 14,
    paddingVertical: 7,
    gap: 8,
    height: 44,
  },
  searchInput: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.text },

  /* MAIN LAYOUT */
  mainLayout: { flex: 1, flexDirection: "row" },

  /* SIDEBAR */
  sidebar: {
    backgroundColor: "#111111",
    borderRightWidth: 1,
    borderRightColor: "#1E1E1E",
  },
  sidebarSearchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1E1E1E",
    backgroundColor: "#161616",
  },
  sidebarSearchInput: {
    flex: 1,
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    height: 24,
  },
  sidebarList: { paddingBottom: 12 },
  sidebarItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#181818",
    minHeight: 44,
    position: "relative",
    overflow: "hidden",
  },
  sidebarItemActive: { backgroundColor: "#E53E3E" },
  sidebarActiveBar: {
    position: "absolute",
    left: 0, top: 0, bottom: 0,
    width: 3,
    backgroundColor: "#fff",
  },
  sidebarNum: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: Colors.textMuted,
    width: 22,
    textAlign: "right",
    marginRight: 6,
  },
  sidebarNumActive: { color: "rgba(255,255,255,0.7)" },
  sidebarLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    flex: 1,
  },
  sidebarLabelActive: { color: "#fff", fontFamily: "Inter_700Bold" },
  sidebarCount: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: Colors.textMuted,
    minWidth: 20,
    textAlign: "right",
  },
  sidebarCountActive: { color: "rgba(255,255,255,0.8)" },

  /* CONTENT */
  contentArea: { flex: 1, backgroundColor: "#0D0D0D" },
  gridList: { padding: GRID_PADDING },
  gridRow: { gap: CARD_GAP, marginBottom: CARD_GAP, justifyContent: "flex-start" },

  /* CHANNEL TILE */
  tile: { alignItems: "center" },
  tilePressed: { opacity: 0.7, transform: [{ scale: 0.94 }] },
  tileLogoBox: {
    backgroundColor: "#181818",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#252525",
    overflow: "hidden",
    position: "relative",
  },
  tileFavBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 8,
    padding: 3,
  },
  tileName: {
    fontFamily: "Inter_400Regular",
    color: "#BBBBBB",
    textAlign: "center",
    lineHeight: 13,
    marginTop: 4,
  },

  /* LIST VIEW */
  listContent: { padding: 8, gap: 4 },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#181818",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: "#252525",
    minHeight: 60,
  },
  listLogoBox: {
    width: 60,
    height: 44,
    borderRadius: 6,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#252525",
  },
  listInfo: { flex: 1 },
  listName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.text },
  listEpg: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 2 },
  listPlayBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#E53E3E",
    alignItems: "center",
    justifyContent: "center",
  },

  /* MOBILE MODAL */
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  categorySheet: {
    backgroundColor: "#141414",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "75%",
    borderWidth: 1,
    borderColor: "#252525",
    paddingTop: 8,
  },
  categorySheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#333",
    alignSelf: "center",
    marginBottom: 12,
  },
  categorySheetTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    paddingHorizontal: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#252525",
  },
  sheetItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1E1E1E",
  },
  sheetItemActive: { backgroundColor: "#1A0505" },
  sheetItemText: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  sheetItemTextActive: { color: "#E53E3E", fontFamily: "Inter_700Bold" },
  sheetItemCount: { fontSize: 12, fontFamily: "Inter_700Bold", color: Colors.textMuted },

  /* EMPTY */
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: Colors.text },
  emptySubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textMuted, textAlign: "center" },
});
