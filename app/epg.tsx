import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  ActivityIndicator,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useIPTV, XtreamCredentials } from "@/context/IPTVContext";
import Colors from "@/constants/colors";
import * as Haptics from "expo-haptics";

// ─── Constants ────────────────────────────────────────────────────────────────
const HOUR_WIDTH = 130;
const CHANNEL_COL = 100;
const ROW_HEIGHT = 60;
const TIME_ROW_H = 36;
const TOTAL_TIMELINE_W = 24 * HOUR_WIDTH;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MAX_CHANNELS = 200;

// ─── Types ────────────────────────────────────────────────────────────────────
interface EpgProgram {
  id: string;
  title: string;
  description: string;
  startMin: number;
  durationMins: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function safeB64(str: string): string {
  try { return atob(str); } catch { return str; }
}

function parseEpgListings(listings: any[]): EpgProgram[] {
  return listings
    .filter((item) => item.start_timestamp && item.stop_timestamp)
    .map((item, i) => {
      const startTs = Number(item.start_timestamp);
      const stopTs = Number(item.stop_timestamp);
      const d = new Date(startTs * 1000);
      const startMin = d.getHours() * 60 + d.getMinutes();
      const durationMins = Math.max(5, Math.round((stopTs - startTs) / 60));
      const title = safeB64(item.title || "").trim() || "Unknown";
      const description = safeB64(item.description || "").trim();
      return { id: String(item.id || i), title, description, startMin, durationMins };
    })
    .filter((p) => p.title);
}

function formatHour(h: number, use24: boolean): string {
  if (use24) return `${String(h).padStart(2, "0")}:00`;
  const period = h < 12 ? "AM" : "PM";
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour} ${period}`;
}

function formatMinutes(min: number, use24: boolean): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (use24) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const period = h < 12 ? "AM" : "PM";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function EPGScreen() {
  const insets = useSafeAreaInsets();
  const { channels, loginType, credentials, getStreamUrl, addToHistory } = useIPTV();

  const [use24h, setUse24h] = useState(false);
  const [selectedDate, setSelectedDate] = useState(2); // index 2 = today
  const [epgData, setEpgData] = useState<Record<string, EpgProgram[]>>({});
  const [loadingEpg, setLoadingEpg] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<EpgProgram | null>(null);

  const timeHeaderRef = useRef<ScrollView>(null);
  const scrollXRef = useRef(0);
  const isFetchingRef = useRef(false);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i - 2);
    return d;
  });

  const isToday = selectedDate === 2;
  const channelsToShow = channels.slice(0, MAX_CHANNELS);
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();

  // Fetch real EPG (Xtream only, today only)
  useEffect(() => {
    if (!isToday || loginType !== "xtream" || channels.length === 0) {
      if (!isToday) setEpgData({});
      return;
    }
    if (isFetchingRef.current) return;
    fetchEpg();
  }, [loginType, isToday, channels.length]);

  const fetchEpg = async () => {
    if (loginType !== "xtream" || isFetchingRef.current) return;
    isFetchingRef.current = true;
    setLoadingEpg(true);

    const creds = credentials as XtreamCredentials;
    const base = `${creds.serverUrl}/player_api.php?username=${creds.username}&password=${creds.password}`;
    const BATCH = 8;

    try {
      const toFetch = channelsToShow.slice();
      for (let i = 0; i < toFetch.length; i += BATCH) {
        const batch = toFetch.slice(i, i + BATCH);
        const results = await Promise.allSettled(
          batch.map(async (ch) => {
            const res = await fetch(`${base}&action=get_short_epg&stream_id=${ch.streamId}&limit=24`, { signal: AbortSignal.timeout(5000) });
            if (!res.ok) throw new Error("bad response");
            const data = await res.json();
            return { streamId: ch.streamId, programs: parseEpgListings(data?.epg_listings || []) };
          })
        );
        const update: Record<string, EpgProgram[]> = {};
        for (const r of results) {
          if (r.status === "fulfilled" && r.value.programs.length > 0) {
            update[r.value.streamId] = r.value.programs;
          }
        }
        if (Object.keys(update).length > 0) {
          setEpgData((prev) => ({ ...prev, ...update }));
        }
      }
    } catch {}

    setLoadingEpg(false);
    isFetchingRef.current = false;
  };

  // Sync time header scroll when any row scrolls
  const handleRowScroll = useCallback((x: number) => {
    if (Math.abs(x - scrollXRef.current) < 1) return;
    scrollXRef.current = x;
    timeHeaderRef.current?.scrollTo({ x, animated: false });
  }, []);

  const playChannel = (streamId: string) => {
    const ch = channels.find((c) => c.streamId === streamId);
    if (!ch) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const url = ch.url || getStreamUrl("live", ch.streamId, "ts");
    addToHistory({ id: ch.streamId, type: "channel", name: ch.name, thumbnail: ch.streamIcon, timestamp: Date.now(), url });
    router.push({ pathname: "/player", params: { url, title: ch.name, logo: ch.streamIcon, type: "live", streamId: ch.streamId } });
  };

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>

      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.title}>TV Guide</Text>
        <View style={styles.headerRight}>
          {loadingEpg && <ActivityIndicator size="small" color={Colors.accent} style={{ marginRight: 8 }} />}
          <Pressable
            style={styles.headerBtn}
            onPress={() => { setUse24h((v) => !v); Haptics.selectionAsync(); }}
          >
            <Text style={styles.timeFormatLabel}>{use24h ? "24H" : "12H"}</Text>
          </Pressable>
        </View>
      </View>

      {/* Date selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.datesRow} contentContainerStyle={styles.datesContent}>
        {dates.map((d, i) => (
          <Pressable
            key={i}
            style={[styles.dateChip, selectedDate === i && styles.dateChipActive]}
            onPress={() => { setSelectedDate(i); Haptics.selectionAsync(); }}
          >
            <Text style={[styles.dateText, selectedDate === i && styles.dateTextActive]}>{formatDate(d)}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Empty states */}
      {channels.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No Channels</Text>
          <Text style={styles.emptySubtitle}>Connect a playlist to view the TV guide</Text>
        </View>
      ) : !isToday ? (
        <View style={styles.emptyState}>
          <Ionicons name="time-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>{selectedDate < 2 ? "Past EPG Unavailable" : "Future EPG Unavailable"}</Text>
          <Text style={styles.emptySubtitle}>Live EPG data is only available for today</Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>

          {/* Sticky time header row */}
          <View style={styles.timelineHeader}>
            <View style={[styles.channelCell, { justifyContent: "center" }]}>
              <Text style={styles.channelCellLabel}>Channel</Text>
            </View>
            <ScrollView
              ref={timeHeaderRef}
              horizontal
              scrollEnabled={false}
              showsHorizontalScrollIndicator={false}
            >
              <View style={{ flexDirection: "row", width: TOTAL_TIMELINE_W }}>
                {HOURS.map((h) => (
                  <View key={h} style={styles.hourLabel}>
                    <Text style={styles.hourText}>{formatHour(h, use24h)}</Text>
                  </View>
                ))}
                {/* Current time bar */}
                <View
                  style={[
                    styles.nowBar,
                    { left: (nowMin / 60) * HOUR_WIDTH },
                  ]}
                  pointerEvents="none"
                />
              </View>
            </ScrollView>
          </View>

          {/* Channel + program rows */}
          <ScrollView showsVerticalScrollIndicator contentContainerStyle={{ paddingBottom: bottomPadding + 20 }}>
            {channelsToShow.map((channel) => {
              const programs = epgData[channel.streamId];
              return (
                <View key={channel.streamId} style={styles.epgRow}>
                  {/* Channel name cell */}
                  <Pressable
                    style={styles.channelCell}
                    onPress={() => playChannel(channel.streamId)}
                  >
                    {channel.streamIcon ? (
                      <Image source={{ uri: channel.streamIcon }} style={styles.channelIcon} resizeMode="contain" />
                    ) : (
                      <Ionicons name="tv-outline" size={18} color={Colors.textMuted} />
                    )}
                    <Text style={styles.channelName} numberOfLines={2}>{channel.name}</Text>
                  </Pressable>

                  {/* Program timeline */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    scrollEventThrottle={16}
                    onScroll={(e) => handleRowScroll(e.nativeEvent.contentOffset.x)}
                  >
                    <View style={{ width: TOTAL_TIMELINE_W, height: ROW_HEIGHT, position: "relative" }}>
                      {/* Current time indicator */}
                      <View
                        style={[styles.nowBarRow, { left: (nowMin / 60) * HOUR_WIDTH }]}
                        pointerEvents="none"
                      />

                      {programs === undefined && loadingEpg ? (
                        <ActivityIndicator
                          size="small"
                          color={Colors.textMuted}
                          style={{ position: "absolute", left: 20, top: ROW_HEIGHT / 2 - 10 }}
                        />
                      ) : programs && programs.length > 0 ? (
                        programs.map((prog) => {
                          const left = (prog.startMin / 60) * HOUR_WIDTH;
                          const w = Math.max(30, (prog.durationMins / 60) * HOUR_WIDTH - 4);
                          const isNow = nowMin >= prog.startMin && nowMin < prog.startMin + prog.durationMins;
                          return (
                            <Pressable
                              key={prog.id}
                              style={[
                                styles.programBlock,
                                { left: left + 2, width: w },
                                isNow && styles.programBlockNow,
                              ]}
                              onPress={() => {
                                Haptics.selectionAsync();
                                setSelectedProgram(prog);
                              }}
                            >
                              <Text style={styles.programTitle} numberOfLines={1}>{prog.title}</Text>
                              <Text style={styles.programTime}>{formatMinutes(prog.startMin, use24h)}</Text>
                            </Pressable>
                          );
                        })
                      ) : (
                        <View style={styles.noEpgRow}>
                          <Text style={styles.noEpgText}>No EPG data</Text>
                        </View>
                      )}
                    </View>
                  </ScrollView>
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Program detail tooltip */}
      {selectedProgram && (
        <Pressable style={styles.programTooltipOverlay} onPress={() => setSelectedProgram(null)}>
          <View style={styles.programTooltip}>
            <View style={styles.programTooltipHeader}>
              <Text style={styles.programTooltipTitle} numberOfLines={2}>{selectedProgram.title}</Text>
              <Pressable onPress={() => setSelectedProgram(null)} hitSlop={10}>
                <Ionicons name="close" size={18} color={Colors.textMuted} />
              </Pressable>
            </View>
            <Text style={styles.programTooltipTime}>
              {formatMinutes(selectedProgram.startMin, use24h)} – {formatMinutes(selectedProgram.startMin + selectedProgram.durationMins, use24h)}
              {"  ·  "}{selectedProgram.durationMins} min
            </Text>
            {selectedProgram.description ? (
              <Text style={styles.programTooltipDesc} numberOfLines={4}>{selectedProgram.description}</Text>
            ) : null}
          </View>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { flex: 1, fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.text },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  headerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  timeFormatLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.accent },
  datesRow: { maxHeight: 42, marginBottom: 10 },
  datesContent: { paddingHorizontal: 16, gap: 7 },
  dateChip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  dateChipActive: { backgroundColor: Colors.accentSoft, borderColor: Colors.accent },
  dateText: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  dateTextActive: { color: Colors.accent },
  timelineHeader: {
    flexDirection: "row",
    height: TIME_ROW_H,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  hourLabel: { width: HOUR_WIDTH, paddingLeft: 8, justifyContent: "center" },
  hourText: { fontSize: 10, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  nowBar: {
    position: "absolute",
    top: 0,
    width: 2,
    height: TIME_ROW_H,
    backgroundColor: Colors.danger,
    zIndex: 10,
  },
  nowBarRow: {
    position: "absolute",
    top: 0,
    width: 2,
    height: ROW_HEIGHT,
    backgroundColor: Colors.danger + "80",
    zIndex: 10,
  },
  epgRow: {
    flexDirection: "row",
    height: ROW_HEIGHT,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  channelCell: {
    width: CHANNEL_COL,
    padding: 6,
    justifyContent: "center",
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    gap: 4,
    backgroundColor: Colors.surface,
  },
  channelCellLabel: {
    fontSize: 9,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  channelIcon: { width: 36, height: 28 },
  channelName: {
    fontSize: 9,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    textAlign: "center",
  },
  programBlock: {
    position: "absolute",
    top: 6,
    height: ROW_HEIGHT - 12,
    backgroundColor: Colors.card,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: "hidden",
  },
  programBlockNow: { backgroundColor: Colors.accentSoft, borderColor: Colors.accent },
  programTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.text },
  programTime: { fontSize: 9, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 2 },
  noEpgRow: { flex: 1, justifyContent: "center", paddingLeft: 12 },
  noEpgText: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyTitle: { fontSize: 20, fontFamily: "Inter_600SemiBold", color: Colors.text },
  emptySubtitle: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textMuted, textAlign: "center", paddingHorizontal: 32 },
  programTooltipOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  programTooltip: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 8,
  },
  programTooltipHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  programTooltipTitle: { flex: 1, fontSize: 17, fontFamily: "Inter_700Bold", color: Colors.text },
  programTooltipTime: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.accent },
  programTooltipDesc: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, lineHeight: 19 },
});
