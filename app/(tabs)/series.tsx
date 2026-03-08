import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
  TextInput,
  Dimensions,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useIPTV, SeriesItem } from "@/context/IPTVContext";
import Colors from "@/constants/colors";
import * as Haptics from "expo-haptics";

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 40 - 12) / 2;

export default function SeriesScreen() {
  const insets = useSafeAreaInsets();
  const { series, seriesCategories, toggleFavorite, isFavorite } = useIPTV();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : 0;

  const allCategories = useMemo(
    () => [{ categoryId: "all", categoryName: "All" }, ...seriesCategories],
    [seriesCategories]
  );

  const filtered = useMemo(() => {
    let list = series;
    if (selectedCategory !== "all") {
      list = list.filter((s) => s.categoryId === selectedCategory);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((s) => s.name.toLowerCase().includes(q));
    }
    return list;
  }, [series, selectedCategory, search]);

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Series</Text>
        <Text style={styles.count}>{filtered.length} shows</Text>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={17} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search series..."
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
      </View>

      <FlatList
        horizontal
        data={allCategories}
        keyExtractor={(c) => c.categoryId}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryList}
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

      {series.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="play-circle-outline" size={56} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No Series</Text>
          <Text style={styles.emptySubtitle}>Connect a series-enabled playlist</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(s) => s.seriesId}
          numColumns={2}
          contentContainerStyle={[styles.grid, { paddingBottom: bottomPadding + 100 }]}
          showsVerticalScrollIndicator={false}
          columnWrapperStyle={styles.row}
          renderItem={({ item }) => (
            <SeriesCard
              item={item}
              isFav={isFavorite("series", item.seriesId)}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({ pathname: "/series-detail/[id]", params: { id: item.seriesId } });
              }}
              onToggleFav={() => {
                toggleFavorite("series", item.seriesId);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
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

function SeriesCard({
  item,
  isFav,
  onPress,
  onToggleFav,
}: {
  item: SeriesItem;
  isFav: boolean;
  onPress: () => void;
  onToggleFav: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={styles.coverContainer}>
        {item.cover ? (
          <Image source={{ uri: item.cover }} style={styles.cover} resizeMode="cover" />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Ionicons name="play-circle" size={36} color={Colors.textMuted} />
          </View>
        )}
        <Pressable
          style={styles.favOverlay}
          onPress={onToggleFav}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
          <Ionicons name={isFav ? "heart" : "heart-outline"} size={16} color={isFav ? Colors.danger : "#fff"} />
        </Pressable>
        {item.rating && (
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={9} color={Colors.warning} />
            <Text style={styles.ratingText}>{parseFloat(item.rating).toFixed(1)}</Text>
          </View>
        )}
      </View>
      <Text style={styles.seriesName} numberOfLines={2}>{item.name}</Text>
      {item.year && <Text style={styles.seriesYear}>{item.year}</Text>}
      {item.genre && <Text style={styles.seriesGenre} numberOfLines={1}>{item.genre}</Text>}
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
    alignItems: "baseline",
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 10,
  },
  title: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  count: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  searchRow: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  searchBox: {
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
  categoryList: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  chipActive: {
    backgroundColor: Colors.accentSoft,
    borderColor: Colors.accent,
  },
  chipText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: Colors.accent,
  },
  grid: {
    paddingHorizontal: 20,
    gap: 12,
  },
  row: {
    gap: 12,
    marginBottom: 4,
  },
  card: {
    width: CARD_WIDTH,
    marginBottom: 8,
  },
  cardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
  coverContainer: {
    width: CARD_WIDTH,
    height: CARD_WIDTH * 1.4,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: Colors.surface,
    marginBottom: 8,
  },
  cover: {
    width: "100%",
    height: "100%",
  },
  coverPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.card,
  },
  favOverlay: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  ratingBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  ratingText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  seriesName: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    lineHeight: 17,
  },
  seriesYear: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    marginTop: 2,
  },
  seriesGenre: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    marginTop: 1,
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
