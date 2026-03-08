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
import { useIPTV, Movie } from "@/context/IPTVContext";
import Colors from "@/constants/colors";
import * as Haptics from "expo-haptics";

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 40 - 16) / 3;

export default function MoviesScreen() {
  const insets = useSafeAreaInsets();
  const { movies, movieCategories, toggleFavorite, isFavorite, getStreamUrl, addToHistory } = useIPTV();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : 0;

  const allCategories = useMemo(
    () => [{ categoryId: "all", categoryName: "All" }, ...movieCategories],
    [movieCategories]
  );

  const filtered = useMemo(() => {
    let list = movies;
    if (selectedCategory !== "all") {
      list = list.filter((m) => m.categoryId === selectedCategory);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((m) => m.name.toLowerCase().includes(q));
    }
    return list;
  }, [movies, selectedCategory, search]);

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Movies</Text>
        <Text style={styles.count}>{filtered.length} titles</Text>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={17} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search movies..."
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

      {movies.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="film-outline" size={56} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No Movies</Text>
          <Text style={styles.emptySubtitle}>Connect a VOD playlist to see movies</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(m) => m.streamId}
          numColumns={3}
          contentContainerStyle={[styles.grid, { paddingBottom: bottomPadding + 100 }]}
          showsVerticalScrollIndicator={false}
          columnWrapperStyle={styles.row}
          renderItem={({ item }) => (
            <MovieCard
              movie={item}
              isFav={isFavorite("movies", item.streamId)}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({ pathname: "/movie/[id]", params: { id: item.streamId } });
              }}
              onToggleFav={() => {
                toggleFavorite("movies", item.streamId);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
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

function MovieCard({
  movie,
  isFav,
  onPress,
  onToggleFav,
}: {
  movie: Movie;
  isFav: boolean;
  onPress: () => void;
  onToggleFav: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={styles.posterContainer}>
        {movie.streamIcon ? (
          <Image source={{ uri: movie.streamIcon }} style={styles.poster} resizeMode="cover" />
        ) : (
          <View style={styles.posterPlaceholder}>
            <Ionicons name="film" size={24} color={Colors.textMuted} />
          </View>
        )}
        <Pressable
          style={styles.favOverlay}
          onPress={onToggleFav}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
          <Ionicons name={isFav ? "heart" : "heart-outline"} size={14} color={isFav ? Colors.danger : "#fff"} />
        </Pressable>
        {movie.rating && (
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={8} color={Colors.warning} />
            <Text style={styles.ratingText}>{parseFloat(movie.rating).toFixed(1)}</Text>
          </View>
        )}
      </View>
      <Text style={styles.movieName} numberOfLines={2}>{movie.name}</Text>
      {movie.year && <Text style={styles.movieYear}>{movie.year}</Text>}
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
    gap: 8,
  },
  row: {
    gap: 8,
    marginBottom: 8,
  },
  card: {
    width: CARD_WIDTH,
  },
  cardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
  posterContainer: {
    width: CARD_WIDTH,
    height: CARD_WIDTH * 1.5,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: Colors.surface,
    marginBottom: 6,
  },
  poster: {
    width: "100%",
    height: "100%",
  },
  posterPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.card,
  },
  favOverlay: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  ratingBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  ratingText: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  movieName: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
    lineHeight: 14,
  },
  movieYear: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    marginTop: 2,
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
