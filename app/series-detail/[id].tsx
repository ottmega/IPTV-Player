import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useIPTV, Episode, XtreamCredentials } from "@/context/IPTVContext";
import Colors from "@/constants/colors";
import * as Haptics from "expo-haptics";

interface SeriesInfo {
  info: {
    name: string;
    cover: string;
    plot?: string;
    rating?: string;
    genre?: string;
    cast?: string;
    releaseDate?: string;
  };
  seasons: Record<string, {
    name: string;
    airDate: string;
    episodes: Episode[];
    cover?: string;
  }>;
}

export default function SeriesDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { series, loginType, credentials, toggleFavorite, isFavorite, getStreamUrl, addToHistory } = useIPTV();

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  const seriesItem = series.find((s) => s.seriesId === id);
  const [seriesInfo, setSeriesInfo] = useState<SeriesInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fav = seriesItem ? isFavorite("series", seriesItem.seriesId) : false;

  useEffect(() => {
    if (!id || !loginType || loginType !== "xtream") return;
    fetchSeriesInfo();
  }, [id]);

  const fetchSeriesInfo = async () => {
    if (loginType !== "xtream") return;
    const creds = credentials as XtreamCredentials;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${creds.serverUrl}/player_api.php?username=${creds.username}&password=${creds.password}&action=get_series_info&series_id=${id}`
      );
      const data = await res.json();
      setSeriesInfo(data);
      const seasonKeys = Object.keys(data.seasons || {});
      if (seasonKeys.length > 0) setSelectedSeason(seasonKeys[0]);
    } catch (e) {
      setError("Failed to load series details");
    } finally {
      setLoading(false);
    }
  };

  if (!seriesItem) {
    return (
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <Pressable style={[styles.backBtn, { margin: 20 }]} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <View style={styles.notFound}>
          <Ionicons name="alert-circle-outline" size={52} color={Colors.textMuted} />
          <Text style={styles.notFoundText}>Series not found</Text>
        </View>
      </View>
    );
  }

  const seasons = seriesInfo?.seasons ? Object.entries(seriesInfo.seasons) : [];
  const currentSeasonEpisodes = selectedSeason && seriesInfo?.seasons[selectedSeason]?.episodes || [];

  return (
    <View style={styles.container}>
      <View style={styles.heroContainer}>
        {seriesItem.cover ? (
          <Image source={{ uri: seriesItem.cover }} style={styles.hero} resizeMode="cover" />
        ) : (
          <View style={[styles.hero, styles.heroPlaceholder]}>
            <Ionicons name="play-circle" size={64} color={Colors.textMuted} />
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
          onPress={() => { toggleFavorite("series", seriesItem.seriesId); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
        >
          <Ionicons name={fav ? "heart" : "heart-outline"} size={24} color={fav ? Colors.danger : "#fff"} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: bottomPadding + 32 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.seriesTitle}>{seriesItem.name}</Text>

        <View style={styles.metaRow}>
          {seriesItem.year && (
            <View style={styles.metaBadge}>
              <Ionicons name="calendar-outline" size={12} color={Colors.textMuted} />
              <Text style={styles.metaText}>{seriesItem.year}</Text>
            </View>
          )}
          {seriesItem.rating && (
            <View style={styles.metaBadge}>
              <Ionicons name="star" size={12} color={Colors.warning} />
              <Text style={styles.metaText}>{parseFloat(seriesItem.rating).toFixed(1)}</Text>
            </View>
          )}
          {seriesItem.genre && (
            <View style={styles.metaBadge}>
              <Text style={styles.metaText}>{seriesItem.genre}</Text>
            </View>
          )}
        </View>

        {seriesItem.plot && (
          <View style={styles.plotSection}>
            <Text style={styles.sectionLabel}>Synopsis</Text>
            <Text style={styles.plotText}>{seriesItem.plot}</Text>
          </View>
        )}

        {loading && (
          <View style={styles.loadingState}>
            <ActivityIndicator color={Colors.accent} />
            <Text style={styles.loadingText}>Loading episodes...</Text>
          </View>
        )}

        {error && (
          <View style={styles.errorState}>
            <Ionicons name="alert-circle-outline" size={32} color={Colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {!loading && seasons.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Seasons</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.seasonsRow} contentContainerStyle={styles.seasonsContent}>
              {seasons.map(([key, season]) => (
                <Pressable
                  key={key}
                  style={[styles.seasonChip, selectedSeason === key && styles.seasonChipActive]}
                  onPress={() => { setSelectedSeason(key); Haptics.selectionAsync(); }}
                >
                  <Text style={[styles.seasonChipText, selectedSeason === key && styles.seasonChipTextActive]}>
                    Season {key}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.sectionLabel}>Episodes</Text>
            {currentSeasonEpisodes.map((ep) => (
              <Pressable
                key={ep.id}
                style={({ pressed }) => [styles.episodeRow, pressed && { opacity: 0.75 }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  const url = ep.url || getStreamUrl("series", ep.id, ep.containerExtension);
                  addToHistory({
                    id: ep.id,
                    type: "episode",
                    name: `${seriesItem.name} S${selectedSeason}E${ep.episodeNum}`,
                    thumbnail: ep.info?.cover || seriesItem.cover,
                    seriesName: seriesItem.name,
                    timestamp: Date.now(),
                    url,
                  });
                  router.push({ pathname: "/player", params: { url, title: `S${selectedSeason} E${ep.episodeNum} - ${ep.title}` } });
                }}
              >
                <View style={styles.epNumBadge}>
                  <Text style={styles.epNum}>{ep.episodeNum}</Text>
                </View>
                <View style={styles.epInfo}>
                  <Text style={styles.epTitle} numberOfLines={1}>{ep.title}</Text>
                  {ep.info?.duration && (
                    <Text style={styles.epMeta}>{ep.info.duration}</Text>
                  )}
                </View>
                <Ionicons name="play-circle-outline" size={24} color={Colors.accent} />
              </Pressable>
            ))}
          </>
        )}

        {!loading && seasons.length === 0 && loginType === "xtream" && !error && (
          <View style={styles.noEpisodes}>
            <Ionicons name="information-circle-outline" size={32} color={Colors.textMuted} />
            <Text style={styles.noEpisodesText}>No episode data available</Text>
          </View>
        )}
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
    height: 300,
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
    height: 180,
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
  seriesTitle: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginBottom: 12,
    lineHeight: 30,
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
    marginBottom: 12,
    textTransform: "uppercase",
  },
  plotText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  loadingState: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  errorState: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 16,
  },
  errorText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.danger,
  },
  seasonsRow: {
    marginBottom: 20,
  },
  seasonsContent: {
    gap: 8,
  },
  seasonChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  seasonChipActive: {
    backgroundColor: Colors.accentSoft,
    borderColor: Colors.accent,
  },
  seasonChipText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  seasonChipTextActive: {
    color: Colors.accent,
  },
  episodeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  epNumBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  epNum: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.textSecondary,
  },
  epInfo: {
    flex: 1,
  },
  epTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  epMeta: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    marginTop: 2,
  },
  noEpisodes: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 10,
  },
  noEpisodesText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
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
