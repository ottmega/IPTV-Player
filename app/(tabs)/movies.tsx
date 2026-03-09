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
import { router } from "expo-router";
import { useIPTV, Movie } from "@/context/IPTVContext";
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

export default function MoviesScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { movies, movieCategories, toggleFavorite, isFavorite, loading, loginType } = useIPTV();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const isPortrait = height > width;
  const isWeb = Platform.OS === "web";

  const topPadding = isWeb ? 67 : insets.top;
  const bottomPadding = isWeb ? 34 : insets.bottom;
  const leftPadding = isWeb ? 16 : Math.max(12, insets.left + 8);
  const rightPadding = isWeb ? 16 : Math.max(12, insets.right + 8);
  const horizPad = leftPadding;

  const innerGap = isPortrait ? 8 : 10;
  const effectiveW = width - leftPadding - rightPadding;
  const numCols = getNumCols(effectiveW, isPortrait);
  const cardWidth = Math.floor((effectiveW - innerGap * (numCols - 1)) / numCols);

  const allCategories = useMemo(
    () => [{ categoryId: "all", categoryName: "All" }, ...movieCategories],
    [movieCategories]
  );

  const filtered = useMemo(() => {
    let list = movies;
    if (selectedCategory !== "all") list = list.filter((m) => m.categoryId === selectedCategory);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((m) => m.name.toLowerCase().includes(q));
    }
    return list;
  }, [movies, selectedCategory, search]);

  return (
    <View style={[styles.container, { paddingTop: topPadding, paddingLeft: leftPadding, paddingRight: rightPadding }]}>
      <View style={[styles.header, { paddingHorizontal: 0 }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Movies</Text>
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

      {movies.length === 0 && (loading || loginType) ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.emptySubtitle}>Loading movies...</Text>
        </View>
      ) : movies.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="film-outline" size={52} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No Movies</Text>
          <Text style={styles.emptySubtitle}>Connect a VOD playlist to see movies</Text>
        </View>
      ) : (
        <FlatList
          key={`movies-${numCols}`}
          data={filtered}
          keyExtractor={(m) => m.streamId}
          numColumns={numCols}
          contentContainerStyle={[styles.grid, { paddingBottom: bottomPadding + 90 }]}
          showsVerticalScrollIndicator={false}
          columnWrapperStyle={{ gap: innerGap, marginBottom: innerGap }}
          renderItem={({ item }) => (
            <MovieCard
              movie={item}
              cardWidth={cardWidth}
              isFav={isFavorite("movies", item.streamId)}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push({ pathname: "/movie/[id]", params: { id: item.streamId } }); }}
              onToggleFav={() => { toggleFavorite("movies", item.streamId); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptySubtitle}>No movies match your search</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

function MovieCard({ movie, cardWidth, isFav, onPress, onToggleFav }: {
  movie: Movie; cardWidth: number; isFav: boolean; onPress: () => void; onToggleFav: () => void;
}) {
  const posterH = cardWidth * 1.5;
  const titleSize = cardWidth < 90 ? 9 : cardWidth < 110 ? 10 : 12;

  return (
    <Pressable style={({ pressed }) => [{ width: cardWidth }, pressed && styles.cardPressed]} onPress={onPress}>
      <View style={[styles.posterContainer, { width: cardWidth, height: posterH }]}>
        {movie.streamIcon ? (
          <Image source={{ uri: movie.streamIcon }} style={styles.poster} resizeMode="cover" />
        ) : (
          <View style={styles.posterPlaceholder}>
            <Ionicons name="film" size={Math.max(18, cardWidth * 0.2)} color={Colors.textMuted} />
          </View>
        )}
        <Pressable style={styles.favOverlay} onPress={onToggleFav} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Ionicons name={isFav ? "heart" : "heart-outline"} size={12} color={isFav ? Colors.danger : "#fff"} />
        </Pressable>
        {movie.rating && (
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={8} color={Colors.warning} />
            <Text style={styles.ratingText}>{parseFloat(movie.rating).toFixed(1)}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.movieName, { fontSize: titleSize }]} numberOfLines={2}>{movie.name}</Text>
      {movie.year && <Text style={styles.movieYear}>{movie.year}</Text>}
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    minHeight: 32,
    justifyContent: "center",
  },
  chipActive: { backgroundColor: Colors.accentSoft, borderColor: Colors.accent },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  chipTextActive: { color: Colors.accent },
  grid: { paddingTop: 4 },
  cardPressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
  posterContainer: {
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: Colors.surface,
    marginBottom: 5,
  },
  poster: { width: "100%", height: "100%" },
  posterPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.card },
  favOverlay: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  ratingBadge: {
    position: "absolute",
    bottom: 5,
    left: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: 5,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  ratingText: { fontSize: 8, fontFamily: "Inter_600SemiBold", color: "#fff" },
  movieName: { fontFamily: "Inter_500Medium", color: Colors.text, lineHeight: 14 },
  movieYear: { fontSize: 9, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 1 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: Colors.text },
  emptySubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textMuted, textAlign: "center" },
});
