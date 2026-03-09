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
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useIPTV, SeriesItem } from "@/context/IPTVContext";
import Colors from "@/constants/colors";
import * as Haptics from "expo-haptics";

function getNumCols(contentW: number, isPortrait: boolean): number {
  if (isPortrait) {
    if (contentW < 320) return 2;
    if (contentW < 480) return 3;
    return 4;
  }
  if (contentW < 380) return 3;
  if (contentW < 560) return 4;
  if (contentW < 800) return 5;
  if (contentW < 1100) return 6;
  return 7;
}

export default function SeriesScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { series, seriesCategories, toggleFavorite, isFavorite, loading, loginType } = useIPTV();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const isPortrait = height > width;
  const isWeb = Platform.OS === "web";

  const isAndroid = Platform.OS === "android";
  const topPadding = isWeb ? 67 : insets.top;
  const listBottomPad = isWeb ? 50 : isAndroid ? insets.bottom + 16 : insets.bottom + 90;
  const leftPadding = isWeb ? 16 : Math.max(12, insets.left + 8);
  const rightPadding = isWeb ? 16 : Math.max(12, insets.right + 8);

  const innerGap = isPortrait ? 8 : 10;
  const effectiveW = width - leftPadding - rightPadding;
  const numCols = getNumCols(effectiveW, isPortrait);
  const cardWidth = Math.floor((effectiveW - innerGap * (numCols - 1)) / numCols);

  const allCategories = useMemo(
    () => [{ categoryId: "all", categoryName: "All" }, ...seriesCategories],
    [seriesCategories]
  );

  const filtered = useMemo(() => {
    let list = series;
    if (selectedCategory !== "all") list = list.filter((s) => s.categoryId === selectedCategory);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((s) => s.name.toLowerCase().includes(q));
    }
    return list;
  }, [series, selectedCategory, search]);

  return (
    <View style={[styles.container, { paddingTop: topPadding, paddingLeft: leftPadding, paddingRight: rightPadding }]}>
      <View style={[styles.header, { paddingHorizontal: 0 }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Series</Text>
          <View style={styles.countBadge}>
            <Text style={styles.count}>{filtered.length}</Text>
          </View>
        </View>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={15} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search..."
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
      </View>

      <FlatList
        horizontal
        data={allCategories}
        keyExtractor={(c) => c.categoryId}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.categoryList]}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.chip, selectedCategory === item.categoryId && styles.chipActive]}
            onPress={() => { setSelectedCategory(item.categoryId); Haptics.selectionAsync(); }}
          >
            <Text style={[styles.chipText, selectedCategory === item.categoryId && styles.chipTextActive]} numberOfLines={1}>
              {item.categoryName}
            </Text>
          </Pressable>
        )}
      />

      {series.length === 0 && (loading || loginType) ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.emptySubtitle}>Loading series...</Text>
        </View>
      ) : series.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="play-circle-outline" size={52} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No Series</Text>
          <Text style={styles.emptySubtitle}>Connect a series-enabled playlist</Text>
        </View>
      ) : (
        <FlatList
          key={`series-${numCols}`}
          data={filtered}
          keyExtractor={(s) => s.seriesId}
          numColumns={numCols}
          contentContainerStyle={[styles.grid, { paddingBottom: listBottomPad }]}
          showsVerticalScrollIndicator={false}
          columnWrapperStyle={{ gap: innerGap, marginBottom: innerGap }}
          renderItem={({ item }) => (
            <SeriesCard
              item={item}
              cardWidth={cardWidth}
              isFav={isFavorite("series", item.seriesId)}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push({ pathname: "/series-detail/[id]", params: { id: item.seriesId } }); }}
              onToggleFav={() => { toggleFavorite("series", item.seriesId); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptySubtitle}>No series match your search</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

function SeriesCard({ item, cardWidth, isFav, onPress, onToggleFav }: {
  item: SeriesItem; cardWidth: number; isFav: boolean; onPress: () => void; onToggleFav: () => void;
}) {
  const coverH = Math.round(cardWidth * 1.45);
  const titleSize = cardWidth < 80 ? 8 : cardWidth < 100 ? 9 : 11;

  return (
    <Pressable style={({ pressed }) => [styles.card, { width: cardWidth }, pressed && styles.cardPressed]} onPress={onPress}>
      <View style={[styles.coverWrap, { height: coverH }]}>
        {item.cover ? (
          <Image source={{ uri: item.cover }} style={StyleSheet.absoluteFill as any} resizeMode="cover" />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Ionicons name="play-circle" size={Math.max(22, cardWidth * 0.28)} color={Colors.textMuted} />
          </View>
        )}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.0)", "rgba(0,0,0,0.88)"]}
          locations={[0, 0.48, 1]}
          style={styles.coverGrad}
        />
        <Pressable style={styles.favOverlay} onPress={onToggleFav} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Ionicons name={isFav ? "heart" : "heart-outline"} size={13} color={isFav ? Colors.danger : "rgba(255,255,255,0.8)"} />
        </Pressable>
        {item.rating && (
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={8} color="#F59E0B" />
            <Text style={styles.ratingText}>{parseFloat(item.rating).toFixed(1)}</Text>
          </View>
        )}
        <View style={styles.coverFooter}>
          <Text style={[styles.coverTitle, { fontSize: titleSize }]} numberOfLines={2}>{item.name}</Text>
          {(item.year || item.genre) ? (
            <Text style={styles.coverMeta} numberOfLines={1}>
              {[item.year, item.genre].filter(Boolean).join(" · ")}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 8,
    gap: 10,
    minHeight: 48,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text },
  countBadge: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  count: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.textMuted },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 36,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    flex: 1,
    maxWidth: 240,
  },
  searchInput: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.text },
  categoryList: { paddingBottom: 8, gap: 7 },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    minHeight: 34,
    justifyContent: "center",
  },
  chipActive: { backgroundColor: Colors.accentSoft, borderColor: Colors.accent },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  chipTextActive: { color: Colors.accent, fontFamily: "Inter_600SemiBold" },
  grid: { paddingTop: 4 },
  cardPressed: { opacity: 0.82, transform: [{ scale: 0.96 }] },
  card: { borderRadius: 12, overflow: "hidden" },
  coverWrap: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  coverPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  coverGrad: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "62%",
  },
  coverFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 7,
  },
  coverTitle: { fontFamily: "Inter_600SemiBold", color: "#fff", lineHeight: 14 },
  coverMeta: { fontSize: 9, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.55)", marginTop: 2 },
  favOverlay: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  ratingBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  ratingText: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#fff" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: Colors.text },
  emptySubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textMuted, textAlign: "center" },
});
