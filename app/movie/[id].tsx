import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ScrollView,
  Platform,
  useWindowDimensions,
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
  const { width, height } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { movies, toggleFavorite, isFavorite, getStreamUrl, addToHistory } = useIPTV();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const sidePad = Platform.OS === "web" ? 32 : Math.max(insets.left, 16);

  const backdropHeight = Math.min(Math.max(height * 0.38, 140), 260);
  const isWide = width >= 600;

  const movie = movies.find((m) => m.streamId === id);

  if (!movie) {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <Pressable style={[styles.floatBtn, { margin: 20 }]} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
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
    router.push({
      pathname: "/player",
      params: { url, title: movie.name, logo: movie.streamIcon, streamId: movie.streamId },
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad + 24 }}
        bounces={false}
      >
        <View style={{ height: backdropHeight }}>
          {movie.streamIcon ? (
            <Image
              source={{ uri: movie.streamIcon }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.backdropPlaceholder]}>
              <Ionicons name="film" size={56} color={Colors.textMuted} />
            </View>
          )}
          <LinearGradient
            colors={["rgba(7,7,20,0.15)", "rgba(7,7,20,0.55)", Colors.bg]}
            style={StyleSheet.absoluteFill}
          />
          <Pressable
            style={[styles.floatBtn, { position: "absolute", top: topPad + 8, left: sidePad }]}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </Pressable>
          <Pressable
            style={[styles.floatBtn, { position: "absolute", top: topPad + 8, right: sidePad }]}
            onPress={() => {
              toggleFavorite("movies", movie.streamId);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Ionicons name={fav ? "heart" : "heart-outline"} size={20} color={fav ? Colors.danger : "#fff"} />
          </Pressable>
        </View>

        <View style={[styles.infoSection, { paddingHorizontal: sidePad, flexDirection: isWide ? "row" : "column" }]}>
          <View style={[styles.posterWrap, isWide ? styles.posterWrapLandscape : styles.posterWrapPortrait]}>
            {movie.streamIcon ? (
              <Image source={{ uri: movie.streamIcon }} style={styles.poster} resizeMode="cover" />
            ) : (
              <View style={[styles.poster, styles.posterPlaceholder]}>
                <Ionicons name="film" size={32} color={Colors.textMuted} />
              </View>
            )}
          </View>

          <View style={[styles.details, isWide && { flex: 1, paddingLeft: 20 }]}>
            <Text style={styles.title} numberOfLines={3}>{movie.name}</Text>

            <View style={styles.metaRow}>
              {movie.year && (
                <View style={styles.metaBadge}>
                  <Ionicons name="calendar-outline" size={11} color={Colors.textMuted} />
                  <Text style={styles.metaText}>{movie.year}</Text>
                </View>
              )}
              {movie.duration && (
                <View style={styles.metaBadge}>
                  <Ionicons name="time-outline" size={11} color={Colors.textMuted} />
                  <Text style={styles.metaText}>{movie.duration}</Text>
                </View>
              )}
              {movie.rating && (
                <View style={styles.metaBadge}>
                  <Ionicons name="star" size={11} color={Colors.warning} />
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
                <Ionicons name="play" size={20} color="#fff" />
                <Text style={styles.playBtnText}>Play Now</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  backdropPlaceholder: {
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  floatBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  infoSection: {
    gap: 16,
    paddingTop: 20,
    alignItems: "flex-start",
  },
  posterWrap: {
    borderRadius: 12,
    overflow: "hidden",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    marginTop: -40,
  },
  posterWrapLandscape: {
    width: 120,
    height: 170,
    flexShrink: 0,
  },
  posterWrapPortrait: {
    width: 100,
    height: 145,
    alignSelf: "flex-start",
  },
  poster: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
  },
  posterPlaceholder: {
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  details: {
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    lineHeight: 28,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  metaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  metaText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  plotSection: {
    gap: 6,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textMuted,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  plotText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  playBtn: {
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 4,
  },
  playBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 50,
    borderRadius: 12,
  },
  playBtnText: {
    fontSize: 15,
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
