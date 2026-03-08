import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ScrollView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useIPTV } from "@/context/IPTVContext";
import Colors from "@/constants/colors";
import * as Haptics from "expo-haptics";

export default function MovieDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { movies, toggleFavorite, isFavorite, getStreamUrl, addToHistory } = useIPTV();

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  const movie = movies.find((m) => m.streamId === id);

  if (!movie) {
    return (
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <Pressable style={[styles.backBtn, { margin: 20 }]} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <View style={styles.notFound}>
          <Ionicons name="alert-circle-outline" size={52} color={Colors.textMuted} />
          <Text style={styles.notFoundText}>Movie not found</Text>
        </View>
      </View>
    );
  }

  const fav = isFavorite("movies", movie.streamId);

  const handlePlay = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const url = movie.url || getStreamUrl("movie", movie.streamId, "mp4");
    addToHistory({
      id: movie.streamId,
      type: "movie",
      name: movie.name,
      thumbnail: movie.streamIcon,
      timestamp: Date.now(),
      url,
    });
    router.push({ pathname: "/player", params: { url, title: movie.name, logo: movie.streamIcon, streamId: movie.streamId } });
  };

  return (
    <View style={[styles.container]}>
      <View style={styles.heroContainer}>
        {movie.streamIcon ? (
          <Image source={{ uri: movie.streamIcon }} style={styles.hero} resizeMode="cover" />
        ) : (
          <View style={[styles.hero, styles.heroPlaceholder]}>
            <Ionicons name="film" size={64} color={Colors.textMuted} />
          </View>
        )}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.6)", Colors.bg]}
          style={styles.heroGradient}
        />
        <Pressable
          style={[styles.backBtn, { top: topPadding + 8, left: 16, position: "absolute" }]}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </Pressable>
        <Pressable
          style={[styles.favBtn, { top: topPadding + 8, right: 16, position: "absolute" }]}
          onPress={() => { toggleFavorite("movies", movie.streamId); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
        >
          <Ionicons name={fav ? "heart" : "heart-outline"} size={24} color={fav ? Colors.danger : "#fff"} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: bottomPadding + 32 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.movieTitle}>{movie.name}</Text>

        <View style={styles.metaRow}>
          {movie.year && (
            <View style={styles.metaBadge}>
              <Ionicons name="calendar-outline" size={12} color={Colors.textMuted} />
              <Text style={styles.metaText}>{movie.year}</Text>
            </View>
          )}
          {movie.duration && (
            <View style={styles.metaBadge}>
              <Ionicons name="time-outline" size={12} color={Colors.textMuted} />
              <Text style={styles.metaText}>{movie.duration}</Text>
            </View>
          )}
          {movie.rating && (
            <View style={styles.metaBadge}>
              <Ionicons name="star" size={12} color={Colors.warning} />
              <Text style={styles.metaText}>{parseFloat(movie.rating).toFixed(1)}</Text>
            </View>
          )}
          {movie.genre && (
            <View style={styles.metaBadge}>
              <Text style={styles.metaText}>{movie.genre}</Text>
            </View>
          )}
        </View>

        {movie.plot && (
          <View style={styles.plotSection}>
            <Text style={styles.sectionLabel}>Synopsis</Text>
            <Text style={styles.plotText}>{movie.plot}</Text>
          </View>
        )}

        <Pressable
          style={({ pressed }) => [styles.playBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
          onPress={handlePlay}
        >
          <LinearGradient
            colors={[Colors.gradient1, Colors.gradient2]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.playBtnGradient}
          >
            <Ionicons name="play" size={22} color="#fff" />
            <Text style={styles.playBtnText}>Play Now</Text>
          </LinearGradient>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  heroContainer: {
    height: 320,
    position: "relative",
  },
  hero: {
    width: "100%",
    height: "100%",
  },
  heroPlaceholder: {
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  heroGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  favBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  movieTitle: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginBottom: 12,
    lineHeight: 32,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  metaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  metaText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  plotSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  plotText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  playBtn: {
    borderRadius: 14,
    overflow: "hidden",
    marginTop: 8,
  },
  playBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 56,
  },
  playBtnText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  notFound: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  notFoundText: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
  },
});
