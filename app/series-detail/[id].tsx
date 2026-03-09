import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ScrollView,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useIPTV, Episode, XtreamCredentials, WatchHistoryItem } from "@/context/IPTVContext";
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
  const { width, height } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { series, loginType, credentials, toggleFavorite, isFavorite, getStreamUrl, addToHistory } = useIPTV();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const sidePad = Platform.OS === "web" ? 32 : Math.max(insets.left, 16);

  const backdropHeight = Math.min(Math.max(height * 0.38, 140), 260);
  const isWide = width >= 600;

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
    } catch {
      setError("Failed to load series details");
    } finally {
      setLoading(false);
    }
  };

  if (!seriesItem) {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <Pressable style={[styles.floatBtn, { margin: 20 }]} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </Pressable>
        <View style={styles.notFound}>
          <Ionicons name="alert-circle-outline" size={52} color={Colors.textMuted} />
          <Text style={styles.notFoundText}>Series not found</Text>
        </View>
      </View>
    );
  }

  const seasons = seriesInfo?.seasons ? Object.entries(seriesInfo.seasons) : [];
  const currentSeasonEpisodes = (selectedSeason && seriesInfo?.seasons[selectedSeason]?.episodes) || [];
  const coverUrl = seriesInfo?.info?.cover || seriesItem.cover;

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad + 24 }}
        bounces={false}
      >
        <View style={{ height: backdropHeight }}>
          {coverUrl ? (
            <Image
              source={{ uri: coverUrl }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.backdropPlaceholder]}>
              <Ionicons name="play-circle" size={56} color={Colors.textMuted} />
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
              toggleFavorite("series", seriesItem.seriesId);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Ionicons name={fav ? "heart" : "heart-outline"} size={20} color={fav ? Colors.danger : "#fff"} />
          </Pressable>
        </View>

        <View style={[styles.infoSection, { paddingHorizontal: sidePad, flexDirection: isWide ? "row" : "column" }]}>
          <View style={[styles.posterWrap, isWide ? styles.posterWrapLandscape : styles.posterWrapPortrait]}>
            {coverUrl ? (
              <Image source={{ uri: coverUrl }} style={styles.poster} resizeMode="cover" />
            ) : (
              <View style={[styles.poster, styles.posterPlaceholder]}>
                <Ionicons name="play-circle" size={32} color={Colors.textMuted} />
              </View>
            )}
          </View>

          <View style={[styles.details, isWide && { flex: 1, paddingLeft: 20 }]}>
            <Text style={styles.title} numberOfLines={3}>{seriesItem.name}</Text>

            <View style={styles.metaRow}>
              {seriesItem.year && (
                <View style={styles.metaBadge}>
                  <Ionicons name="calendar-outline" size={11} color={Colors.textMuted} />
                  <Text style={styles.metaText}>{seriesItem.year}</Text>
                </View>
              )}
              {seriesItem.rating && (
                <View style={styles.metaBadge}>
                  <Ionicons name="star" size={11} color={Colors.warning} />
                  <Text style={styles.metaText}>{parseFloat(seriesItem.rating).toFixed(1)}</Text>
                </View>
              )}
              {seriesItem.genre && (
                <View style={styles.metaBadge}>
                  <Text style={styles.metaText}>{seriesItem.genre}</Text>
                </View>
              )}
            </View>

            {(seriesInfo?.info?.plot || seriesItem.plot) && (
              <View style={styles.plotSection}>
                <Text style={styles.sectionLabel}>Synopsis</Text>
                <Text style={styles.plotText}>{seriesInfo?.info?.plot || seriesItem.plot}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={{ paddingHorizontal: sidePad, marginTop: 24 }}>
          {loading && (
            <View style={styles.loadingState}>
              <ActivityIndicator color={Colors.accent} size="small" />
              <Text style={styles.loadingText}>Loading episodes...</Text>
            </View>
          )}

          {error && (
            <View style={styles.errorState}>
              <Ionicons name="alert-circle-outline" size={28} color={Colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {!loading && seasons.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Seasons</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.seasonsRow}
                contentContainerStyle={styles.seasonsContent}
              >
                {seasons.map(([key]) => (
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

              <Text style={[styles.sectionLabel, { marginTop: 20 }]}>
                Episodes {currentSeasonEpisodes.length > 0 ? `(${currentSeasonEpisodes.length})` : ""}
              </Text>

              {currentSeasonEpisodes.map((ep) => (
                <EpisodeRow
                  key={ep.id}
                  ep={ep}
                  selectedSeason={selectedSeason}
                  seriesItem={seriesItem}
                  getStreamUrl={getStreamUrl}
                  addToHistory={addToHistory}
                />
              ))}

              {currentSeasonEpisodes.length === 0 && (
                <View style={styles.noEpisodes}>
                  <Text style={styles.noEpisodesText}>No episodes in this season</Text>
                </View>
              )}
            </>
          )}

          {!loading && seasons.length === 0 && loginType === "xtream" && !error && (
            <View style={styles.noEpisodes}>
              <Ionicons name="information-circle-outline" size={32} color={Colors.textMuted} />
              <Text style={styles.noEpisodesText}>No episode data available</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function EpisodeRow({
  ep,
  selectedSeason,
  seriesItem,
  getStreamUrl,
  addToHistory,
}: {
  ep: Episode;
  selectedSeason: string | null;
  seriesItem: { name: string; cover?: string };
  getStreamUrl: (type: "live" | "series" | "movie", id: string, ext?: string) => string;
  addToHistory: (item: WatchHistoryItem) => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.episodeRow, pressed && { opacity: 0.7, backgroundColor: Colors.surface }]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const url = ep.url || getStreamUrl("series", ep.id, ep.containerExtension);
        addToHistory({
          id: ep.id,
          type: "episode",
          name: `${seriesItem.name} S${selectedSeason}E${ep.episodeNum}`,
          thumbnail: ep.info?.cover || seriesItem.cover || "",
          seriesName: seriesItem.name,
          timestamp: Date.now(),
          url,
        });
        router.push({
          pathname: "/player",
          params: { url, title: `S${selectedSeason} E${ep.episodeNum} - ${ep.title}` },
        });
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
      <Ionicons name="play-circle-outline" size={26} color={Colors.accent} />
    </Pressable>
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
    marginBottom: 10,
  },
  plotText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  loadingState: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 16,
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
    marginBottom: 4,
  },
  seasonsContent: {
    gap: 8,
    paddingVertical: 4,
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
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 2,
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
    minWidth: 0,
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
    paddingVertical: 28,
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
