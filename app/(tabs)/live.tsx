import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
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
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useIPTV, Channel, Category } from "@/context/IPTVContext";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";

// ─── Types ──────────────────────────────────────────────────────────────────
type ViewLevel = "categories" | "channels";
type SortMode = "default" | "top-added" | "az" | "za" | "num-asc" | "num-desc";
type ChannelViewMode = "grid" | "list";

const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: "default", label: "Default" },
  { key: "top-added", label: "Top Added" },
  { key: "az", label: "A-Z" },
  { key: "za", label: "Z-A" },
  { key: "num-asc", label: "Channel Number Ascending" },
  { key: "num-desc", label: "Channel Number descending" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const GRID_COLS = 4;
const GRID_PAD = 8;
const GRID_GAP = 6;

function getGridItemWidth(totalW: number) {
  return Math.floor((totalW - GRID_PAD * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS);
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function LiveTVScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const {
    channels, liveCategories, toggleFavorite, isFavorite,
    getStreamUrl, addToHistory, loading, loginType, history, favorites,
  } = useIPTV();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  // ── Navigation State ───────────────────────────────────────────────────────
  const [viewLevel, setViewLevel] = useState<ViewLevel>("categories");
  const [activeCat, setActiveCat] = useState<Category>({ categoryId: "", categoryName: "" });

  // ── Channels Screen State ──────────────────────────────────────────────────
  const [channelSearch, setChannelSearch] = useState("");
  const [showChannelSearch, setShowChannelSearch] = useState(false);
  const [channelViewMode, setChannelViewMode] = useState<ChannelViewMode>("grid");
  const [sortMode, setSortMode] = useState<SortMode>("default");
  const [pendingSortMode, setPendingSortMode] = useState<SortMode>("default");
  const [showSortModal, setShowSortModal] = useState(false);
  const [showCatDropdown, setShowCatDropdown] = useState(false);

  // ── Category Count Map ─────────────────────────────────────────────────────
  const countByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const ch of channels) {
      if (ch.categoryId) map[ch.categoryId] = (map[ch.categoryId] || 0) + 1;
    }
    return map;
  }, [channels]);

  // ── All categories (with specials first) ──────────────────────────────────
  const allCategories = useMemo<Category[]>(() => [
    { categoryId: "all", categoryName: "All" },
    { categoryId: "recent", categoryName: "Recent Watch" },
    { categoryId: "favorites", categoryName: "FAVORITES" },
    ...liveCategories,
  ], [liveCategories]);

  const getCategoryCount = useCallback((catId: string) => {
    if (catId === "all") return channels.length;
    if (catId === "recent") return history.filter((h) => h.type === "channel").slice(0, 999).length;
    if (catId === "favorites") return favorites.channels.length;
    return countByCategory[catId] || 0;
  }, [channels, history, favorites.channels, countByCategory]);

  // ── Filtered + sorted channels for current category ───────────────────────
  const filteredChannels = useMemo(() => {
    if (!activeCat.categoryId) return [];
    let list: Channel[];

    if (activeCat.categoryId === "all") {
      list = [...channels];
    } else if (activeCat.categoryId === "recent") {
      const recentIds = history.filter((h) => h.type === "channel").map((h) => h.id);
      const seen = new Set<string>();
      list = recentIds
        .map((id) => channels.find((c) => c.streamId === id))
        .filter((c): c is Channel => !!c && !seen.has(c.streamId) && !!(seen.add(c.streamId) || true));
    } else if (activeCat.categoryId === "favorites") {
      const favSet = new Set(favorites.channels);
      list = channels.filter((c) => favSet.has(c.streamId));
    } else {
      list = channels.filter((c) => c.categoryId === activeCat.categoryId);
    }

    if (channelSearch) {
      const q = channelSearch.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q));
    }

    switch (sortMode) {
      case "top-added": return [...list].sort((a, b) => Number(b.streamId) - Number(a.streamId));
      case "az": return [...list].sort((a, b) => a.name.localeCompare(b.name));
      case "za": return [...list].sort((a, b) => b.name.localeCompare(a.name));
      case "num-asc": return [...list].sort((a, b) => Number(a.streamId) - Number(b.streamId));
      case "num-desc": return [...list].sort((a, b) => Number(b.streamId) - Number(a.streamId));
      default: return list;
    }
  }, [activeCat, channels, history, favorites.channels, channelSearch, sortMode, isFavorite]);

  // ── Navigate to category channels ─────────────────────────────────────────
  const openCategory = (cat: Category) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveCat(cat);
    setChannelSearch("");
    setShowChannelSearch(false);
    setSortMode("default");
    setPendingSortMode("default");
    setShowCatDropdown(false);
    setViewLevel("channels");
  };

  // ── Open channel in player ────────────────────────────────────────────────
  const openChannel = useCallback((channel: Channel) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const url = channel.url || getStreamUrl("live", channel.streamId, "ts");
    addToHistory({ id: channel.streamId, type: "channel", name: channel.name, thumbnail: channel.streamIcon, timestamp: Date.now(), url });
    router.push({ pathname: "/player", params: { url, title: channel.name, logo: channel.streamIcon, type: "live", streamId: channel.streamId } });
  }, [getStreamUrl, addToHistory]);

  const gridItemWidth = getGridItemWidth(width);

  // ── CATEGORIES VIEW ───────────────────────────────────────────────────────
  if (viewLevel === "categories") {
    return (
      <View style={[styles.screen, { paddingTop: topPad }]}>
        {/* Header */}
        <View style={styles.catHeader}>
          <Text style={styles.catHeaderTitle}>Live TV</Text>
          <View style={styles.catHeaderRight}>
            <Pressable style={styles.headerBtn} onPress={() => Haptics.selectionAsync()}>
              <Ionicons name="radio-outline" size={22} color="rgba(255,255,255,0.75)" />
            </Pressable>
            <Pressable style={styles.headerBtn} onPress={() => {
              router.push("/search" as any);
              Haptics.selectionAsync();
            }}>
              <Ionicons name="search-outline" size={22} color="rgba(255,255,255,0.75)" />
            </Pressable>
            <Pressable style={styles.headerBtn} onPress={() => {
              setPendingSortMode("default");
              setShowSortModal(true);
              Haptics.selectionAsync();
            }}>
              <Ionicons name="swap-vertical-outline" size={22} color="rgba(255,255,255,0.75)" />
            </Pressable>
          </View>
        </View>

        {/* Categories List */}
        {channels.length === 0 && (loading || loginType) ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color={Colors.accent} />
            <Text style={styles.emptyText}>Loading categories...</Text>
          </View>
        ) : channels.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="tv-outline" size={52} color="rgba(255,255,255,0.2)" />
            <Text style={styles.emptyTitle}>No Channels</Text>
            <Text style={styles.emptyText}>Connect a playlist to see live TV</Text>
          </View>
        ) : (
          <FlatList
            data={allCategories}
            keyExtractor={(c) => c.categoryId}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.catList, { paddingBottom: bottomPad + 16 }]}
            renderItem={({ item }) => {
              const count = getCategoryCount(item.categoryId);
              const isSpecial = item.categoryId === "all" || item.categoryId === "recent" || item.categoryId === "favorites";
              return (
                <Pressable
                  style={({ pressed }) => [styles.catRow, pressed && styles.catRowPressed]}
                  onPress={() => openCategory(item)}
                >
                  <View style={styles.catFolderIcon}>
                    <Ionicons name="folder" size={26} color="#FFC107" />
                  </View>
                  <Text style={[styles.catName, isSpecial && styles.catNameSpecial]} numberOfLines={1}>
                    {item.categoryName}
                  </Text>
                  <Text style={styles.catCount}>{count}</Text>
                  <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
                </Pressable>
              );
            }}
            ItemSeparatorComponent={() => <View style={styles.catSeparator} />}
          />
        )}
      </View>
    );
  }

  // ── CHANNELS VIEW ─────────────────────────────────────────────────────────
  return (
    <View style={[styles.screen, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.chHeader}>
        <Pressable style={styles.backBtn} onPress={() => {
          setViewLevel("categories");
          setShowCatDropdown(false);
          setShowChannelSearch(false);
          setChannelSearch("");
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </Pressable>

        <Pressable
          style={styles.chTitleBtn}
          onPress={() => { setShowCatDropdown(true); Haptics.selectionAsync(); }}
        >
          <Text style={styles.chTitleText} numberOfLines={1}>{activeCat.categoryName}</Text>
          <Ionicons name="chevron-down" size={16} color="rgba(255,255,255,0.6)" />
        </Pressable>

        <View style={styles.chHeaderRight}>
          <Pressable style={styles.headerBtn} onPress={() => {
            setShowChannelSearch((v) => !v);
            if (showChannelSearch) setChannelSearch("");
            Haptics.selectionAsync();
          }}>
            <Ionicons name="search-outline" size={21} color={showChannelSearch ? Colors.accent : "rgba(255,255,255,0.75)"} />
          </Pressable>
          <Pressable style={styles.headerBtn} onPress={() => {
            setChannelViewMode((v) => v === "grid" ? "list" : "grid");
            Haptics.selectionAsync();
          }}>
            <Ionicons
              name={channelViewMode === "grid" ? "list-outline" : "grid-outline"}
              size={21}
              color="rgba(255,255,255,0.75)"
            />
          </Pressable>
          <Pressable style={styles.headerBtn} onPress={() => {
            setPendingSortMode(sortMode);
            setShowSortModal(true);
            Haptics.selectionAsync();
          }}>
            <Ionicons name="swap-vertical-outline" size={21} color={sortMode !== "default" ? Colors.accent : "rgba(255,255,255,0.75)"} />
          </Pressable>
        </View>
      </View>

      {/* Search bar */}
      {showChannelSearch && (
        <View style={styles.searchBar}>
          <Ionicons name="search" size={15} color="rgba(255,255,255,0.4)" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search channels..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={channelSearch}
            onChangeText={setChannelSearch}
            autoCapitalize="none"
            autoFocus
          />
          {channelSearch.length > 0 && (
            <Pressable onPress={() => setChannelSearch("")} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.4)" />
            </Pressable>
          )}
        </View>
      )}

      {/* Channel count bar */}
      <View style={styles.countBar}>
        <Text style={styles.countText}>
          {filteredChannels.length} channel{filteredChannels.length !== 1 ? "s" : ""}
          {channelSearch ? ` · "${channelSearch}"` : ""}
          {sortMode !== "default" ? `  ·  ${SORT_OPTIONS.find((s) => s.key === sortMode)?.label}` : ""}
        </Text>
      </View>

      {/* Channel content */}
      {filteredChannels.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={36} color="rgba(255,255,255,0.2)" />
          <Text style={styles.emptyText}>No channels found</Text>
        </View>
      ) : channelViewMode === "grid" ? (
        <FlatList
          key="grid"
          data={filteredChannels}
          keyExtractor={(c) => c.streamId}
          numColumns={GRID_COLS}
          contentContainerStyle={[styles.gridContent, { paddingBottom: bottomPad + 90 }]}
          columnWrapperStyle={styles.gridRow}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          windowSize={8}
          initialNumToRender={24}
          maxToRenderPerBatch={20}
          renderItem={({ item }) => (
            <ChannelGridTile
              channel={item}
              size={gridItemWidth}
              isFav={isFavorite("channels", item.streamId)}
              onPress={() => openChannel(item)}
              onToggleFav={() => { toggleFavorite("channels", item.streamId); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            />
          )}
        />
      ) : (
        <FlatList
          key="list"
          data={filteredChannels}
          keyExtractor={(c) => c.streamId}
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomPad + 90 }]}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          windowSize={8}
          initialNumToRender={24}
          maxToRenderPerBatch={20}
          ItemSeparatorComponent={() => <View style={styles.listSep} />}
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

      {/* ── Category Dropdown Overlay ── */}
      <Modal visible={showCatDropdown} transparent animationType="fade" onRequestClose={() => setShowCatDropdown(false)}>
        <View style={styles.dropdownOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowCatDropdown(false)} />
          <ScrollView
            contentContainerStyle={styles.dropdownList}
            showsVerticalScrollIndicator={false}
          >
            {allCategories.map((cat) => {
              const isActive = cat.categoryId === activeCat.categoryId;
              return (
                <Pressable
                  key={cat.categoryId}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setActiveCat(cat);
                    setShowCatDropdown(false);
                    setChannelSearch("");
                    setSortMode("default");
                    Haptics.selectionAsync();
                  }}
                >
                  <Text style={[styles.dropdownItemText, isActive && styles.dropdownItemTextActive]}>
                    {cat.categoryName}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Pressable
            style={styles.dropdownClose}
            onPress={() => { setShowCatDropdown(false); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          >
            <Ionicons name="close" size={22} color="#fff" />
          </Pressable>
        </View>
      </Modal>

      {/* ── Sort Modal ── */}
      <Modal visible={showSortModal} transparent animationType="fade" onRequestClose={() => setShowSortModal(false)}>
        <View style={styles.sortOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowSortModal(false)} />
          <View style={styles.sortModal}>
            <View style={styles.sortIconCircle}>
              <Ionicons name="swap-vertical" size={26} color="#fff" />
            </View>
            <Text style={styles.sortTitle}>Sort According to :</Text>
            {SORT_OPTIONS.map((opt) => (
              <Pressable
                key={opt.key}
                style={styles.sortOption}
                onPress={() => { setPendingSortMode(opt.key); Haptics.selectionAsync(); }}
              >
                <View style={[styles.sortRadio, pendingSortMode === opt.key && styles.sortRadioActive]}>
                  {pendingSortMode === opt.key && <View style={styles.sortRadioDot} />}
                </View>
                <Text style={styles.sortOptionText}>{opt.label}</Text>
              </Pressable>
            ))}
            <View style={styles.sortActions}>
              <Pressable
                style={styles.sortSaveBtn}
                onPress={() => {
                  setSortMode(pendingSortMode);
                  setShowSortModal(false);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }}
              >
                <Text style={styles.sortSaveBtnText}>Save</Text>
              </Pressable>
              <Pressable
                style={styles.sortCancelBtn}
                onPress={() => { setShowSortModal(false); Haptics.selectionAsync(); }}
              >
                <Text style={styles.sortCancelBtnText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Grid Tile ────────────────────────────────────────────────────────────────
function ChannelGridTile({ channel, size, isFav, onPress, onToggleFav }: {
  channel: Channel; size: number; isFav: boolean; onPress: () => void; onToggleFav: () => void;
}) {
  const [imgErr, setImgErr] = useState(false);
  const logoSize = Math.round(size * 0.65);

  return (
    <Pressable
      style={({ pressed }) => [styles.gridTile, { width: size }, pressed && { opacity: 0.75 }]}
      onPress={onPress}
      onLongPress={onToggleFav}
    >
      <View style={[styles.gridTileBox, { width: size, height: size }]}>
        {channel.streamIcon && !imgErr ? (
          <Image source={{ uri: channel.streamIcon }} style={{ width: logoSize, height: logoSize }} resizeMode="contain" onError={() => setImgErr(true)} />
        ) : (
          <View style={styles.gridPlaceholder}>
            <Ionicons name="tv" size={Math.round(logoSize * 0.45)} color="rgba(255,255,255,0.2)" />
          </View>
        )}
        {isFav && (
          <View style={styles.gridFavDot}>
            <Ionicons name="heart" size={8} color={Colors.danger} />
          </View>
        )}
      </View>
      <Text style={[styles.gridTileName, { width: size }]} numberOfLines={2}>{channel.name}</Text>
    </Pressable>
  );
}

// ─── List Row ─────────────────────────────────────────────────────────────────
function ChannelListRow({ channel, isFav, onPress, onToggleFav }: {
  channel: Channel; isFav: boolean; onPress: () => void; onToggleFav: () => void;
}) {
  const [imgErr, setImgErr] = useState(false);

  return (
    <Pressable style={({ pressed }) => [styles.listRow, pressed && { opacity: 0.75 }]} onPress={onPress} onLongPress={onToggleFav}>
      <View style={styles.listLogoBox}>
        {channel.streamIcon && !imgErr ? (
          <Image source={{ uri: channel.streamIcon }} style={{ width: 58, height: 40 }} resizeMode="contain" onError={() => setImgErr(true)} />
        ) : (
          <Ionicons name="tv" size={24} color="rgba(255,255,255,0.25)" />
        )}
      </View>
      <Text style={styles.listName} numberOfLines={1}>{channel.name}</Text>
      <Pressable onPress={onToggleFav} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
        <Ionicons name={isFav ? "heart" : "heart-outline"} size={18} color={isFav ? Colors.danger : "rgba(255,255,255,0.25)"} />
      </Pressable>
    </Pressable>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#111" },

  // ── Categories Header ────────────────────────────────────────────────────
  catHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#111",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.07)",
  },
  catHeaderTitle: {
    flex: 1,
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: 0.2,
  },
  catHeaderRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  headerBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20 },

  // ── Category List ────────────────────────────────────────────────────────
  catList: { paddingTop: 4 },
  catRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#1C1C1E",
    gap: 14,
  },
  catRowPressed: { backgroundColor: "#252528" },
  catFolderIcon: { width: 34, alignItems: "center" },
  catName: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium", color: "#fff" },
  catNameSpecial: { fontFamily: "Inter_600SemiBold" },
  catCount: { fontSize: 15, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.45)", minWidth: 30, textAlign: "right" },
  catSeparator: { height: 1, backgroundColor: "rgba(255,255,255,0.06)" },

  // ── Channels Header ──────────────────────────────────────────────────────
  chHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: "#111",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.07)",
    gap: 6,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  chTitleBtn: { flex: 1, flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 4 },
  chTitleText: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#fff", flexShrink: 1 },
  chHeaderRight: { flexDirection: "row", alignItems: "center", gap: 2 },

  // ── Search Bar ──────────────────────────────────────────────────────────
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#1C1C1E",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", color: "#fff", height: 26 },

  // ── Count Bar ───────────────────────────────────────────────────────────
  countBar: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
    backgroundColor: "#111",
  },
  countText: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.4)" },

  // ── Grid ────────────────────────────────────────────────────────────────
  gridContent: { paddingHorizontal: GRID_PAD, paddingTop: 8, gap: GRID_GAP },
  gridRow: { gap: GRID_GAP },
  gridTile: { alignItems: "center", marginBottom: 10 },
  gridTileBox: {
    backgroundColor: "#1C1C1E",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  gridPlaceholder: { alignItems: "center", justifyContent: "center", flex: 1 },
  gridFavDot: {
    position: "absolute", top: 4, right: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 8, padding: 2,
  },
  gridTileName: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.75)",
    textAlign: "center",
    marginTop: 5,
    lineHeight: 14,
  },

  // ── List ────────────────────────────────────────────────────────────────
  listContent: { paddingTop: 4 },
  listSep: { height: 1, backgroundColor: "rgba(255,255,255,0.05)", marginLeft: 86 },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#111",
    gap: 12,
  },
  listLogoBox: {
    width: 72,
    height: 52,
    backgroundColor: "#1C1C1E",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  listName: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: "#fff" },

  // ── Empty ───────────────────────────────────────────────────────────────
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: "#fff" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.4)", textAlign: "center" },

  // ── Category Dropdown Overlay ────────────────────────────────────────────
  dropdownOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.88)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 48,
  },
  dropdownList: { alignItems: "center", gap: 2, paddingVertical: 16 },
  dropdownItem: { paddingVertical: 11, paddingHorizontal: 24, alignItems: "center" },
  dropdownItemText: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: "#fff", textAlign: "center" },
  dropdownItemTextActive: { color: Colors.danger },
  dropdownClose: {
    marginTop: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },

  // ── Sort Modal ───────────────────────────────────────────────────────────
  sortOverlay: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.55)", padding: 24 },
  sortModal: {
    backgroundColor: "#fff",
    borderRadius: 16,
    width: "100%",
    maxWidth: 360,
    paddingBottom: 20,
    paddingHorizontal: 20,
    alignItems: "stretch",
    overflow: "visible",
    marginTop: 36,
  },
  sortIconCircle: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: Colors.danger,
    alignItems: "center", justifyContent: "center",
    alignSelf: "center",
    marginTop: -30,
    marginBottom: 16,
  },
  sortTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#111", marginBottom: 14, textAlign: "center" },
  sortOption: { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 14 },
  sortRadio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: "#aaa",
    alignItems: "center", justifyContent: "center",
  },
  sortRadioActive: { borderColor: Colors.danger },
  sortRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.danger },
  sortOptionText: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#111" },
  sortActions: { flexDirection: "row", gap: 12, marginTop: 18 },
  sortSaveBtn: { flex: 1, backgroundColor: Colors.danger, borderRadius: 10, paddingVertical: 13, alignItems: "center" },
  sortSaveBtnText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" },
  sortCancelBtn: { flex: 1, borderWidth: 2, borderColor: Colors.danger, borderRadius: 10, paddingVertical: 13, alignItems: "center" },
  sortCancelBtnText: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.danger },
});
