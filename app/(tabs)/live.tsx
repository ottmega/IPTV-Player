import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
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
  ActivityIndicator,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useIPTV, Channel } from "@/context/IPTVContext";
import * as Haptics from "expo-haptics";

const SIDEBAR_W = 240;
const CARD_GAP = 10;
const GRID_PADDING = 10;
const MIN_TILE = 130;

function computeCols(contentW: number): number {
  return Math.max(2, Math.floor(contentW / MIN_TILE));
}

function computeCardSize(contentW: number, cols: number): number {
  return Math.floor((contentW - GRID_PADDING * 2 - CARD_GAP * (cols - 1)) / cols);
}

function useNow() {
  const [now, setNow] = useState(new Date());
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    ref.current = setInterval(() => setNow(new Date()), 30000);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, []);
  const h = now.getHours() % 12 || 12;
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ampm = now.getHours() >= 12 ? "pm" : "am";
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return {
    time: `${String(h).padStart(2, "0")}:${mm} ${ampm}`,
    date: `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`,
  };
}

export default function LiveTVScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const {
    channels, liveCategories, toggleFavorite, isFavorite,
    getStreamUrl, addToHistory, loading, loginType,
  } = useIPTV();

  const [search, setSearch] = useState("");
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"name" | "favorites">("name");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const { time, date } = useNow();

  const isPortrait = height > width;
  const isWeb = Platform.OS === "web";
  const isAndroid = Platform.OS === "android";
  const isMobile = width < 600;
  const sidebarVisible = !isMobile;

  const topPadding = isWeb ? 67 : insets.top;
  const listBottomPad = isWeb ? 50 : !isPortrait ? insets.bottom + 8 : isAndroid ? insets.bottom + 16 : insets.bottom + 90;
  const leftPadding = isWeb ? 0 : insets.left;
  const rightPadding = isWeb ? 0 : insets.right;

  const contentWidth = width - leftPadding - rightPadding - (sidebarVisible ? SIDEBAR_W : 0);
  const numCols = computeCols(contentWidth);
  const cardSize = computeCardSize(contentWidth, numCols);

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

  const openChannel = useCallback((channel: Channel) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const url = channel.url || getStreamUrl("live", channel.streamId, "ts");
    addToHistory({ id: channel.streamId, type: "channel", name: channel.name, thumbnail: channel.streamIcon, timestamp: Date.now(), url });
    router.push({ pathname: "/player", params: { url, title: channel.name, logo: channel.streamIcon, type: "live", streamId: channel.streamId } });
  }, [getStreamUrl, addToHistory]);

  const selectCategory = (id: string) => {
    setSelectedCategory(id);
    setShowCategoryModal(false);
    Haptics.selectionAsync();
  };

  const getCategoryCount = useCallback((categoryId: string) => {
    if (categoryId === "all") return channels.length;
    if (categoryId === "favorites") return channels.filter((ch) => isFavorite("channels", ch.streamId)).length;
    return channelCountByCategory[categoryId] || 0;
  }, [channels, channelCountByCategory, isFavorite]);

  const renderTile = useCallback(({ item }: { item: Channel }) => (
    <ChannelTile
      channel={item}
      size={cardSize}
      isFav={isFavorite("channels", item.streamId)}
      onPress={() => openChannel(item)}
      onToggleFav={() => { toggleFavorite("channels", item.streamId); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
    />
  ), [cardSize, isFavorite, openChannel, toggleFavorite]);

  const renderListRow = useCallback(({ item }: { item: Channel }) => (
    <ChannelListRow
      channel={item}
      isFav={isFavorite("channels", item.streamId)}
      onPress={() => openChannel(item)}
      onToggleFav={() => { toggleFavorite("channels", item.streamId); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
    />
  ), [isFavorite, openChannel, toggleFavorite]);

  return (
    <View style={[styles.container, { paddingTop: topPadding, paddingLeft: leftPadding, paddingRight: rightPadding }]}>

      {/* HEADER - XCIPTV Style */}
      <LinearGradient
        colors={["#1A3A6B", "#0D2247", "#071428"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        {/* Left: Time + Date */}
        <View style={styles.headerLeft}>
          <Text style={styles.headerTime}>{time}</Text>
          <Text style={styles.headerDate}>{date}</Text>
        </View>

        {/* Center: Logo */}
        <View style={styles.headerCenter}>
          <View style={styles.logoCircle}>
            <Ionicons name="play" size={18} color="#fff" style={{ marginLeft: 2 }} />
          </View>
        </View>

        {/* Right: Category + controls */}
        <View style={styles.headerRight}>
          <Pressable
            style={styles.headerCategoryBtn}
            onPress={() => { if (isMobile) { setShowCategoryModal(true); Haptics.selectionAsync(); } }}
          >
            <Text style={styles.headerCategoryName} numberOfLines={1}>{selectedLabel.toUpperCase()}</Text>
            {isMobile && <Ionicons name="chevron-down" size={12} color="rgba(255,255,255,0.6)" />}
            {filtered.length > 0 && (
              <Text style={styles.headerCategoryCount}> ({filtered.length})</Text>
            )}
          </Pressable>
          <View style={styles.headerActions}>
            <Pressable style={styles.headerIconBtn} onPress={() => { setSortBy((s) => s === "name" ? "favorites" : "name"); Haptics.selectionAsync(); }}>
              <Ionicons name={sortBy === "favorites" ? "heart" : "heart-outline"} size={18} color={sortBy === "favorites" ? "#FF4444" : "rgba(255,255,255,0.7)"} />
            </Pressable>
            <Pressable style={styles.headerIconBtn} onPress={() => { setViewMode((v) => v === "grid" ? "list" : "grid"); Haptics.selectionAsync(); }}>
              <Ionicons name={viewMode === "grid" ? "list" : "grid"} size={18} color="rgba(255,255,255,0.7)" />
            </Pressable>
            <Pressable
              style={[styles.headerIconBtn, search.length > 0 && styles.headerIconBtnActive]}
              onPress={() => { setShowSearch(true); Haptics.selectionAsync(); }}
            >
              <Ionicons name="search" size={18} color={search.length > 0 ? "#FFD700" : "rgba(255,255,255,0.7)"} />
            </Pressable>
          </View>
        </View>
      </LinearGradient>

      {/* BODY (header below, search overlay lives here) */}
      <View style={styles.bodyArea}>
      {/* MAIN LAYOUT */}
      <View style={styles.mainLayout}>

        {/* SIDEBAR */}
        {sidebarVisible && (
          <LinearGradient
            colors={["#0F1D3A", "#0A1428", "#070E1E"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={[styles.sidebar, { width: SIDEBAR_W }]}
          >
            {/* Sidebar search */}
            <View style={styles.sidebarSearchWrap}>
              <Ionicons name="search" size={13} color="rgba(255,255,255,0.4)" />
              <TextInput
                style={styles.sidebarSearchInput}
                placeholder="Search..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={sidebarSearch}
                onChangeText={setSidebarSearch}
                autoCapitalize="none"
              />
              {sidebarSearch.length > 0 && (
                <Pressable onPress={() => setSidebarSearch("")} hitSlop={6}>
                  <Ionicons name="close-circle" size={13} color="rgba(255,255,255,0.4)" />
                </Pressable>
              )}
            </View>

            <FlatList
              data={filteredSidebarCategories}
              keyExtractor={(c) => c.categoryId}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.sidebarList}
              removeClippedSubviews
              windowSize={10}
              renderItem={({ item }) => {
                const isActive = selectedCategory === item.categoryId;
                const count = getCategoryCount(item.categoryId);
                return (
                  <Pressable
                    style={[styles.sidebarItem, isActive && styles.sidebarItemActive]}
                    onPress={() => { setSelectedCategory(item.categoryId); Haptics.selectionAsync(); }}
                  >
                    {isActive && <View style={styles.sidebarActiveBar} />}
                    <Text
                      style={[styles.sidebarLabel, isActive && styles.sidebarLabelActive]}
                      numberOfLines={2}
                    >
                      {item.categoryName}
                      {count > 0 && (
                        <Text style={[styles.sidebarCount, isActive && styles.sidebarCountActive]}>
                          {" "}({count})
                        </Text>
                      )}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </LinearGradient>
        )}

        {/* CHANNEL CONTENT */}
        <View style={styles.contentArea}>
          {channels.length === 0 && (loading || loginType) ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color="#4F8EF7" />
              <Text style={styles.emptySubtitle}>Loading channels...</Text>
            </View>
          ) : channels.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="tv-outline" size={52} color="rgba(255,255,255,0.3)" />
              <Text style={styles.emptyTitle}>No Channels</Text>
              <Text style={styles.emptySubtitle}>Connect a playlist to see channels</Text>
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={36} color="rgba(255,255,255,0.3)" />
              <Text style={styles.emptySubtitle}>No channels match your search</Text>
            </View>
          ) : viewMode === "grid" ? (
            <FlatList
              key={`grid-${numCols}`}
              data={filtered}
              keyExtractor={(c) => c.streamId}
              numColumns={numCols}
              contentContainerStyle={[styles.gridList, { paddingBottom: listBottomPad }]}
              columnWrapperStyle={styles.gridRow}
              showsVerticalScrollIndicator={false}
              removeClippedSubviews
              windowSize={8}
              initialNumToRender={20}
              maxToRenderPerBatch={16}
              renderItem={renderTile}
            />
          ) : (
            <FlatList
              key="list"
              data={filtered}
              keyExtractor={(c) => c.streamId}
              contentContainerStyle={[styles.listContent, { paddingBottom: listBottomPad }]}
              showsVerticalScrollIndicator={false}
              removeClippedSubviews
              windowSize={8}
              initialNumToRender={20}
              maxToRenderPerBatch={16}
              renderItem={renderListRow}
            />
          )}
        </View>
      </View>

      {/* SEARCH OVERLAY */}
      {showSearch && (
        <View style={[StyleSheet.absoluteFill, styles.searchOverlay]}>
          <View style={styles.searchOverlayBar}>
            <Ionicons name="search" size={16} color="rgba(255,255,255,0.5)" />
            <TextInput
              style={styles.searchOverlayInput}
              placeholder="Search channels..."
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              autoFocus
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch("")} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.45)" />
              </Pressable>
            )}
            <Pressable
              onPress={() => { setShowSearch(false); setSearch(""); Haptics.selectionAsync(); }}
              hitSlop={10}
              style={styles.searchOverlayCloseBtn}
            >
              <Text style={styles.searchOverlayCloseText}>Cancel</Text>
            </Pressable>
          </View>
          {search.length > 0 && (
            <Text style={styles.searchResultCount}>{filtered.length} channel{filtered.length !== 1 ? "s" : ""} found</Text>
          )}
          <FlatList
            key={`search-${numCols}`}
            data={filtered}
            keyExtractor={(c) => c.streamId}
            numColumns={numCols}
            columnWrapperStyle={numCols > 1 ? styles.gridRow : undefined}
            contentContainerStyle={[styles.gridList, { paddingBottom: listBottomPad }]}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews
            windowSize={8}
            initialNumToRender={24}
            maxToRenderPerBatch={16}
            keyboardShouldPersistTaps="handled"
            renderItem={renderTile}
          />
        </View>
      )}
      </View>

      {/* MOBILE CATEGORY MODAL */}
      <Modal visible={showCategoryModal} transparent animationType="slide" onRequestClose={() => setShowCategoryModal(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowCategoryModal(false)} />
          <LinearGradient
            colors={["#0F1D3A", "#070E1E"]}
            style={styles.categorySheet}
          >
            <View style={styles.categorySheetHandle} />
            <Text style={styles.categorySheetTitle}>Select Category</Text>
            <FlatList
              data={allCategories}
              keyExtractor={(c) => c.categoryId}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: listBottomPad }}
              renderItem={({ item }) => {
                const isActive = selectedCategory === item.categoryId;
                const count = getCategoryCount(item.categoryId);
                return (
                  <Pressable
                    style={[styles.sheetItem, isActive && styles.sheetItemActive]}
                    onPress={() => selectCategory(item.categoryId)}
                  >
                    <Text style={[styles.sheetItemText, isActive && styles.sheetItemTextActive]} numberOfLines={1}>
                      {item.categoryName}
                    </Text>
                    <Text style={[styles.sheetItemCount, isActive && { color: "#FFD700" }]}>
                      {count > 0 ? `(${count})` : ""}
                    </Text>
                    {isActive && <Ionicons name="checkmark" size={16} color="#FFD700" style={{ marginLeft: 6 }} />}
                  </Pressable>
                );
              }}
            />
          </LinearGradient>
        </View>
      </Modal>
    </View>
  );
}

function ChannelTile({ channel, size, isFav, onPress, onToggleFav }: {
  channel: Channel; size: number; isFav: boolean; onPress: () => void; onToggleFav: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const logoSize = Math.round(size * 0.68);
  const fontSize = size < 100 ? 9 : size < 130 ? 10 : 11;

  return (
    <Pressable
      style={({ pressed }) => [styles.tile, { width: size }, pressed && styles.tilePressed]}
      onPress={onPress}
    >
      <View style={[styles.tileBox, { width: size, height: size }]}>
        {channel.streamIcon && !imgError ? (
          <Image
            source={{ uri: channel.streamIcon }}
            style={{ width: logoSize, height: logoSize }}
            resizeMode="contain"
            onError={() => setImgError(true)}
          />
        ) : (
          <View style={styles.tilePlaceholder}>
            <Ionicons name="tv" size={Math.round(logoSize * 0.5)} color="rgba(255,255,255,0.25)" />
          </View>
        )}
        {isFav && (
          <Pressable style={styles.tileFavBtn} onPress={onToggleFav} hitSlop={6}>
            <Ionicons name="heart" size={11} color="#FF4444" />
          </Pressable>
        )}
        {!isFav && (
          <Pressable style={styles.tileFavBtnInactive} onPress={onToggleFav} hitSlop={8}>
            <Ionicons name="heart-outline" size={11} color="rgba(255,255,255,0.3)" />
          </Pressable>
        )}
      </View>
      <Text style={[styles.tileName, { fontSize, width: size }]} numberOfLines={2}>
        {channel.name}
      </Text>
    </Pressable>
  );
}

function ChannelListRow({ channel, isFav, onPress, onToggleFav }: {
  channel: Channel; isFav: boolean; onPress: () => void; onToggleFav: () => void;
}) {
  const [imgError, setImgError] = useState(false);

  return (
    <Pressable style={({ pressed }) => [styles.listRow, pressed && styles.tilePressed]} onPress={onPress}>
      <View style={styles.listLogoBox}>
        {channel.streamIcon && !imgError ? (
          <Image
            source={{ uri: channel.streamIcon }}
            style={{ width: 52, height: 38 }}
            resizeMode="contain"
            onError={() => setImgError(true)}
          />
        ) : (
          <Ionicons name="tv" size={22} color="rgba(255,255,255,0.3)" />
        )}
      </View>
      <View style={styles.listInfo}>
        <Text style={styles.listName} numberOfLines={1}>{channel.name}</Text>
        {channel.epgChannelId ? <Text style={styles.listEpg} numberOfLines={1}>{channel.epgChannelId}</Text> : null}
      </View>
      <Pressable onPress={onToggleFav} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name={isFav ? "heart" : "heart-outline"} size={18} color={isFav ? "#FF4444" : "rgba(255,255,255,0.3)"} />
      </Pressable>
      <View style={styles.listPlayBtn}>
        <Ionicons name="play" size={14} color="#fff" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#080F1E" },

  /* HEADER */
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
    minHeight: 56,
    gap: 8,
  },
  headerLeft: { flex: 1, alignItems: "flex-start" },
  headerTime: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 0.3 },
  headerDate: { fontSize: 10, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.55)", marginTop: 1 },
  headerCenter: { alignItems: "center", justifyContent: "center" },
  logoCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#3B73C8",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.25)",
  },
  headerRight: { flex: 1, alignItems: "flex-end", gap: 4 },
  headerCategoryBtn: { flexDirection: "row", alignItems: "center", maxWidth: "100%" },
  headerCategoryName: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 0.5, flexShrink: 1 },
  headerCategoryCount: { fontSize: 10, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.55)" },
  headerActions: { flexDirection: "row", gap: 8 },
  headerIconBtn: { padding: 4 },
  headerIconBtnActive: { opacity: 1 },

  /* BODY AREA */
  bodyArea: { flex: 1, position: "relative" },

  /* SEARCH OVERLAY */
  searchOverlay: {
    backgroundColor: "#080F1E",
    zIndex: 50,
  },
  searchOverlayBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111C30",
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  searchOverlayInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "#fff",
    height: 28,
  },
  searchOverlayCloseBtn: {
    paddingLeft: 6,
    paddingVertical: 4,
  },
  searchOverlayCloseText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "#FFD700",
  },
  searchResultCount: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.4)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },

  /* MAIN LAYOUT */
  mainLayout: { flex: 1, flexDirection: "row" },

  /* SIDEBAR */
  sidebar: {
    borderRightWidth: 1,
    borderRightColor: "rgba(255,255,255,0.06)",
  },
  sidebarSearchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  sidebarSearchInput: {
    flex: 1,
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#fff",
    height: 22,
  },
  sidebarList: { paddingBottom: 16 },
  sidebarItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
    minHeight: 48,
    position: "relative",
    overflow: "hidden",
  },
  sidebarItemActive: { backgroundColor: "rgba(255,215,0,0.08)" },
  sidebarActiveBar: {
    position: "absolute",
    left: 0, top: 0, bottom: 0,
    width: 3,
    backgroundColor: "#FFD700",
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  sidebarLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.75)",
    flex: 1,
    lineHeight: 17,
  },
  sidebarLabelActive: { color: "#FFD700", fontFamily: "Inter_700Bold" },
  sidebarCount: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.45)",
  },
  sidebarCountActive: { color: "rgba(255,215,0,0.7)" },

  /* CONTENT */
  contentArea: { flex: 1, backgroundColor: "#080F1E" },
  gridList: { padding: GRID_PADDING },
  gridRow: { gap: CARD_GAP, marginBottom: CARD_GAP, justifyContent: "flex-start" },

  /* CHANNEL TILE */
  tile: { alignItems: "center" },
  tilePressed: { opacity: 0.72, transform: [{ scale: 0.95 }] },
  tileBox: {
    backgroundColor: "#111C30",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    overflow: "hidden",
    position: "relative",
  },
  tilePlaceholder: { alignItems: "center", justifyContent: "center" },
  tileFavBtn: {
    position: "absolute",
    top: 5,
    right: 5,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 8,
    padding: 3,
  },
  tileFavBtnInactive: {
    position: "absolute",
    top: 5,
    right: 5,
    padding: 3,
  },
  tileName: {
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
    lineHeight: 14,
    marginTop: 5,
  },

  /* LIST VIEW */
  listContent: { padding: 8, gap: 4 },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111C30",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    minHeight: 60,
  },
  listLogoBox: {
    width: 64,
    height: 46,
    borderRadius: 7,
    backgroundColor: "#0A1428",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  listInfo: { flex: 1 },
  listName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
  listEpg: { fontSize: 10, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.4)", marginTop: 2 },
  listPlayBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#3B73C8",
    alignItems: "center",
    justifyContent: "center",
  },

  /* MOBILE MODAL */
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.7)" },
  categorySheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "75%",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingTop: 8,
  },
  categorySheetHandle: {
    width: 36, height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignSelf: "center",
    marginBottom: 12,
  },
  categorySheetTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    paddingHorizontal: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  sheetItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  sheetItemActive: { backgroundColor: "rgba(255,215,0,0.06)" },
  sheetItemText: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.7)" },
  sheetItemTextActive: { color: "#FFD700", fontFamily: "Inter_700Bold" },
  sheetItemCount: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.35)" },

  /* EMPTY */
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: "#fff" },
  emptySubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.4)", textAlign: "center" },
});
