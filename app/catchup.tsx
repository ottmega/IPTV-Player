import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
  Platform,
  useWindowDimensions,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useIPTV, XtreamCredentials } from "@/context/IPTVContext";
import Colors from "@/constants/colors";
import * as Haptics from "expo-haptics";

const DAYS_BACK = 7;

interface Program {
  id: string;
  title: string;
  description: string;
  startHour: number;
  startMin: number;
  durationMins: number;
  category: string;
}

const PROGRAM_POOL: { title: string; category: string; duration: number; description: string }[] = [
  { title: "Morning News", category: "News", duration: 60, description: "Start your day with the latest headlines" },
  { title: "Weather Report", category: "News", duration: 30, description: "National and local weather forecast" },
  { title: "Business Today", category: "Finance", duration: 30, description: "Markets, stocks and economy news" },
  { title: "Sports Highlights", category: "Sports", duration: 45, description: "Last night's best plays and scores" },
  { title: "Documentary: Nature", category: "Documentary", duration: 90, description: "Explore the natural world" },
  { title: "Action Movie", category: "Movies", duration: 120, description: "High-octane action blockbuster" },
  { title: "Prime Time News", category: "News", duration: 60, description: "Evening news roundup" },
  { title: "Talk Show", category: "Entertainment", duration: 60, description: "Celebrity interviews and live music" },
  { title: "Comedy Series", category: "Comedy", duration: 30, description: "Fan-favourite comedy show" },
  { title: "Drama Series", category: "Drama", duration: 60, description: "Gripping primetime drama" },
  { title: "Late Night Show", category: "Entertainment", duration: 90, description: "Comedy and celebrity guests" },
  { title: "Cooking Show", category: "Lifestyle", duration: 30, description: "Chef masterclass recipes" },
  { title: "Travel & Culture", category: "Lifestyle", duration: 45, description: "Explore destinations worldwide" },
  { title: "Football Match", category: "Sports", duration: 120, description: "Live football action" },
  { title: "Science Documentary", category: "Documentary", duration: 60, description: "Space, tech and science" },
];

function generatePrograms(channelId: string, date: Date): Program[] {
  const seed = channelId.split("").reduce((a, c) => a + c.charCodeAt(0), 0) + date.getDate();
  const programs: Program[] = [];
  let currentMin = 360;

  while (currentMin < 1440) {
    const idx = (seed + programs.length * 7) % PROGRAM_POOL.length;
    const pool = PROGRAM_POOL[idx];
    const durationVariant = pool.duration + ((seed + programs.length) % 3) * 15;
    programs.push({
      id: `${channelId}-${date.getDate()}-${programs.length}`,
      title: pool.title,
      description: pool.description,
      startHour: Math.floor(currentMin / 60),
      startMin: currentMin % 60,
      durationMins: durationVariant,
      category: pool.category,
    });
    currentMin += durationVariant;
  }
  return programs;
}

function formatTime(h: number, m: number) {
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${String(hour).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatDay(d: Date) {
  if (d.toDateString() === new Date().toDateString()) return "Today";
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatDate(d: Date) {
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function isCurrentlyAiring(prog: Program, selectedDate: Date): boolean {
  const now = new Date();
  if (selectedDate.toDateString() !== now.toDateString()) return false;
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const start = prog.startHour * 60 + prog.startMin;
  return nowMins >= start && nowMins < start + prog.durationMins;
}

function isInPast(prog: Program, selectedDate: Date): boolean {
  const now = new Date();
  if (selectedDate < now) return true;
  if (selectedDate.toDateString() !== now.toDateString()) return false;
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const start = prog.startHour * 60 + prog.startMin;
  return start + prog.durationMins <= nowMins;
}

export default function CatchUpScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { channels, loginType, credentials, getStreamUrl, addToHistory } = useIPTV();

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;
  const leftPadding = Platform.OS === "web" ? 0 : insets.left;

  const days = useMemo(() => {
    return Array.from({ length: DAYS_BACK }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (DAYS_BACK - 1 - i));
      d.setHours(0, 0, 0, 0);
      return d;
    });
  }, []);

  const [selectedDayIdx, setSelectedDayIdx] = useState(days.length - 1);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const isWide = width >= 700;

  const archiveChannels = useMemo(
    () => channels.filter((c) => c.tvArchive === 1 || c.tvArchive === undefined).slice(0, 100),
    [channels]
  );

  const displayChannels = archiveChannels.length > 0 ? archiveChannels : channels.slice(0, 50);

  const selectedDay = days[selectedDayIdx];

  const programs = useMemo(() => {
    if (!selectedChannel) return [];
    return generatePrograms(selectedChannel, selectedDay);
  }, [selectedChannel, selectedDay]);

  const selectedChannelObj = channels.find((c) => c.streamId === selectedChannel);

  const getCatchupUrl = useCallback((prog: Program): string => {
    if (!selectedChannel) return "";
    if (loginType === "xtream" && credentials) {
      const c = credentials as XtreamCredentials;
      const startDate = new Date(selectedDay);
      startDate.setHours(prog.startHour, prog.startMin, 0, 0);
      const y = startDate.getFullYear();
      const mo = String(startDate.getMonth() + 1).padStart(2, "0");
      const d = String(startDate.getDate()).padStart(2, "0");
      const h = String(startDate.getHours()).padStart(2, "0");
      const mi = String(startDate.getMinutes()).padStart(2, "0");
      const startFormatted = `${y}-${mo}-${d}:${h}-${mi}`;
      return `${c.serverUrl}/timeshift/${c.username}/${c.password}/${prog.durationMins}/${startFormatted}/${selectedChannel}.ts`;
    }
    return getStreamUrl("live", selectedChannel, "ts");
  }, [selectedChannel, selectedDay, loginType, credentials, getStreamUrl]);

  const playProgram = (prog: Program) => {
    if (!selectedChannelObj) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const url = getCatchupUrl(prog);
    const startTime = formatTime(prog.startHour, prog.startMin);
    addToHistory({
      id: `catchup-${prog.id}`,
      type: "channel",
      name: `${prog.title} — ${selectedChannelObj.name}`,
      thumbnail: selectedChannelObj.streamIcon,
      timestamp: Date.now(),
      url,
    });
    router.push({
      pathname: "/player",
      params: {
        url: encodeURIComponent(url),
        title: prog.title,
        logo: selectedChannelObj.streamIcon,
        type: "live",
        genre: prog.category,
        year: startTime,
        episode: selectedChannelObj.name,
      },
    });
  };

  return (
    <View style={[styles.container, { paddingTop: topPadding, paddingLeft: leftPadding }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>Catch-Up TV</Text>
          <Text style={styles.subtitle}>{formatDate(selectedDay)}</Text>
        </View>
        {selectedChannel && (
          <Pressable style={styles.clearBtn} onPress={() => setSelectedChannel(null)}>
            <Ionicons name="list-outline" size={18} color={Colors.accent} />
          </Pressable>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.daysList}
      >
        {days.map((d, i) => (
          <Pressable
            key={i}
            style={[styles.dayChip, selectedDayIdx === i && styles.dayChipActive]}
            onPress={() => { setSelectedDayIdx(i); setSelectedChannel(null); Haptics.selectionAsync(); }}
          >
            <Text style={[styles.dayText, selectedDayIdx === i && styles.dayTextActive]}>
              {formatDay(d)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {isWide ? (
        <View style={styles.wideLayout}>
          <View style={styles.wideSidebar}>
            <Text style={styles.sidebarTitle}>CHANNELS</Text>
            {channels.length === 0 ? (
              <View style={styles.emptyMini}>
                <Ionicons name="tv-outline" size={32} color={Colors.textMuted} />
                <Text style={styles.emptyMiniText}>No channels. Connect a playlist first.</Text>
              </View>
            ) : (
              <FlatList
                data={displayChannels}
                keyExtractor={(c) => c.streamId}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: bottomPadding + 80 }}
                renderItem={({ item }) => (
                  <Pressable
                    style={[styles.sidebarChannel, selectedChannel === item.streamId && styles.sidebarChannelActive]}
                    onPress={() => { setSelectedChannel(item.streamId); Haptics.selectionAsync(); }}
                  >
                    {selectedChannel === item.streamId && <View style={styles.sidebarActiveBar} />}
                    <View style={styles.sidebarLogo}>
                      {item.streamIcon ? (
                        <Image source={{ uri: item.streamIcon }} style={{ width: 28, height: 20 }} resizeMode="contain" />
                      ) : (
                        <Ionicons name="tv" size={14} color={Colors.textMuted} />
                      )}
                    </View>
                    <Text style={[styles.sidebarLabel, selectedChannel === item.streamId && styles.sidebarLabelActive]} numberOfLines={1}>
                      {item.name}
                    </Text>
                  </Pressable>
                )}
              />
            )}
          </View>
          <View style={styles.wideProgramArea}>
            {selectedChannel ? (
              <ProgramList
                programs={programs}
                selectedDay={selectedDay}
                onPlay={playProgram}
                channelName={selectedChannelObj?.name || ""}
                bottomPadding={bottomPadding}
              />
            ) : (
              <View style={styles.selectPrompt}>
                <LinearGradient colors={[Colors.gradient1 + "30", Colors.gradient2 + "30"]} style={styles.selectIcon}>
                  <Ionicons name="time" size={32} color={Colors.accent} />
                </LinearGradient>
                <Text style={styles.selectTitle}>Select a Channel</Text>
                <Text style={styles.selectText}>Choose a channel from the list to see its program schedule for {formatDay(selectedDay)}</Text>
              </View>
            )}
          </View>
        </View>
      ) : (
        <>
          {!selectedChannel ? (
            channels.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="time-outline" size={52} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No Channels</Text>
                <Text style={styles.emptySubtitle}>Connect a playlist to use Catch-Up TV.</Text>
              </View>
            ) : (
              <FlatList
                data={displayChannels}
                keyExtractor={(c) => c.streamId}
                contentContainerStyle={[styles.list, { paddingBottom: bottomPadding + 80 }]}
                showsVerticalScrollIndicator={false}
                initialNumToRender={20}
                maxToRenderPerBatch={20}
                windowSize={10}
                renderItem={({ item }) => (
                  <Pressable
                    style={({ pressed }) => [styles.channelRow, pressed && { opacity: 0.75 }]}
                    onPress={() => { setSelectedChannel(item.streamId); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                  >
                    <View style={styles.channelLogo}>
                      {item.streamIcon ? (
                        <Image source={{ uri: item.streamIcon }} style={{ width: 34, height: 26 }} resizeMode="contain" />
                      ) : (
                        <Ionicons name="tv" size={18} color={Colors.textMuted} />
                      )}
                    </View>
                    <View style={styles.channelInfo}>
                      <Text style={styles.channelName} numberOfLines={1}>{item.name}</Text>
                      <View style={styles.archiveBadge}>
                        <Ionicons name="time" size={10} color={Colors.success} />
                        <Text style={styles.archiveText}>{DAYS_BACK} days catch-up available</Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                  </Pressable>
                )}
              />
            )
          ) : (
            <View style={{ flex: 1 }}>
              <View style={styles.channelBanner}>
                {selectedChannelObj?.streamIcon ? (
                  <Image source={{ uri: selectedChannelObj.streamIcon }} style={{ width: 36, height: 28 }} resizeMode="contain" />
                ) : (
                  <Ionicons name="tv" size={20} color={Colors.textMuted} />
                )}
                <Text style={styles.channelBannerName} numberOfLines={1}>{selectedChannelObj?.name}</Text>
                <Pressable onPress={() => setSelectedChannel(null)} style={styles.channelBannerBack}>
                  <Ionicons name="close" size={16} color={Colors.textMuted} />
                </Pressable>
              </View>
              <ProgramList
                programs={programs}
                selectedDay={selectedDay}
                onPlay={playProgram}
                channelName={selectedChannelObj?.name || ""}
                bottomPadding={bottomPadding}
              />
            </View>
          )}
        </>
      )}
    </View>
  );
}

function ProgramList({ programs, selectedDay, onPlay, channelName, bottomPadding }: {
  programs: Program[];
  selectedDay: Date;
  onPlay: (p: Program) => void;
  channelName: string;
  bottomPadding: number;
}) {
  const now = new Date();
  const isToday = selectedDay.toDateString() === now.toDateString();
  const nowMins = now.getHours() * 60 + now.getMinutes();

  return (
    <FlatList
      data={programs}
      keyExtractor={(p) => p.id}
      contentContainerStyle={[styles.programList, { paddingBottom: bottomPadding + 80 }]}
      showsVerticalScrollIndicator={false}
      initialNumToRender={15}
      maxToRenderPerBatch={15}
      renderItem={({ item }) => {
        const startMins = item.startHour * 60 + item.startMin;
        const endMins = startMins + item.durationMins;
        const airing = isCurrentlyAiring(item, selectedDay);
        const past = isInPast(item, selectedDay);
        const canWatch = past || airing;
        const progress = airing ? Math.min((nowMins - startMins) / item.durationMins, 1) : 0;
        const endH = Math.floor(endMins / 60) % 24;
        const endM = endMins % 60;

        return (
          <View style={[styles.programRow, airing && styles.programRowAiring]}>
            {airing && <View style={styles.airingIndicator} />}
            <View style={styles.programTime}>
              <Text style={[styles.programTimeText, airing && { color: Colors.accent }]}>
                {formatTime(item.startHour, item.startMin)}
              </Text>
              <Text style={styles.programEndTime}>{formatTime(endH, endM)}</Text>
              <Text style={styles.programDuration}>{item.durationMins}min</Text>
            </View>
            <View style={styles.programInfo}>
              <View style={styles.programTitleRow}>
                <Text style={[styles.programTitle, !canWatch && { color: Colors.textMuted }]} numberOfLines={1}>
                  {item.title}
                </Text>
                {airing && (
                  <View style={styles.nowBadge}>
                    <View style={styles.nowDot} />
                    <Text style={styles.nowText}>LIVE</Text>
                  </View>
                )}
                <View style={[styles.categoryChip, { backgroundColor: getCategoryColor(item.category) + "25" }]}>
                  <Text style={[styles.categoryText, { color: getCategoryColor(item.category) }]}>{item.category}</Text>
                </View>
              </View>
              <Text style={styles.programDesc} numberOfLines={1}>{item.description}</Text>
              {airing && progress > 0 && (
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${Math.min(progress * 100, 100)}%` as any }]} />
                </View>
              )}
            </View>
            {canWatch ? (
              <Pressable style={({ pressed }) => [styles.watchBtn, pressed && { opacity: 0.8 }]} onPress={() => onPlay(item)}>
                <Ionicons name={airing ? "play" : "time"} size={14} color="#fff" />
                <Text style={styles.watchBtnText}>{airing ? "Watch" : "Replay"}</Text>
              </Pressable>
            ) : (
              <View style={styles.watchBtnDisabled}>
                <Ionicons name="lock-closed-outline" size={14} color={Colors.textMuted} />
              </View>
            )}
          </View>
        );
      }}
    />
  );
}

function getCategoryColor(cat: string): string {
  const map: Record<string, string> = {
    News: "#3B82F6",
    Sports: "#10B981",
    Movies: "#A855F7",
    Drama: "#EC4899",
    Comedy: "#F59E0B",
    Documentary: "#06B6D4",
    Finance: "#6366F1",
    Entertainment: "#F97316",
    Lifestyle: "#84CC16",
  };
  return map[cat] || Colors.accent;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 10, gap: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.cardBorder },
  headerText: { flex: 1 },
  title: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text },
  subtitle: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 1 },
  clearBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.cardBorder },
  daysList: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  dayChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.cardBorder },
  dayChipActive: { backgroundColor: Colors.accentSoft, borderColor: Colors.accent },
  dayText: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  dayTextActive: { color: Colors.accent },
  wideLayout: { flex: 1, flexDirection: "row" },
  wideSidebar: { width: 200, backgroundColor: Colors.surface, borderRightWidth: 1, borderRightColor: Colors.border },
  sidebarTitle: { fontSize: 10, fontFamily: "Inter_700Bold", color: Colors.textMuted, letterSpacing: 1, textTransform: "uppercase", paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  sidebarChannel: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, gap: 8, position: "relative", borderBottomWidth: 1, borderBottomColor: Colors.border + "60" },
  sidebarChannelActive: { backgroundColor: Colors.accentSoft },
  sidebarActiveBar: { position: "absolute", left: 0, top: 0, bottom: 0, width: 3, backgroundColor: Colors.accent },
  sidebarLogo: { width: 32, height: 24, alignItems: "center", justifyContent: "center" },
  sidebarLabel: { flex: 1, fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.textMuted },
  sidebarLabelActive: { color: Colors.text, fontFamily: "Inter_600SemiBold" },
  wideProgramArea: { flex: 1 },
  selectPrompt: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, paddingHorizontal: 40 },
  selectIcon: { width: 72, height: 72, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  selectTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: Colors.text },
  selectText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textMuted, textAlign: "center", lineHeight: 20 },
  emptyMini: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 20 },
  emptyMiniText: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textMuted, textAlign: "center", lineHeight: 18 },
  list: { paddingHorizontal: 16, gap: 6 },
  channelRow: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.surface, borderRadius: 12, padding: 12, gap: 12, borderWidth: 1, borderColor: Colors.cardBorder, marginBottom: 2 },
  channelLogo: { width: 46, height: 36, borderRadius: 8, backgroundColor: Colors.card, alignItems: "center", justifyContent: "center" },
  channelInfo: { flex: 1 },
  channelName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.text, marginBottom: 3 },
  archiveBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  archiveText: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.success },
  channelBanner: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  channelBannerName: { flex: 1, fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.text },
  channelBannerBack: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.card, alignItems: "center", justifyContent: "center" },
  programList: { paddingHorizontal: 12, gap: 6 },
  programRow: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.surface, borderRadius: 12, padding: 12, gap: 12, borderWidth: 1, borderColor: Colors.cardBorder, position: "relative", overflow: "hidden" },
  programRowAiring: { borderColor: Colors.accent + "60", backgroundColor: Colors.accentSoft },
  airingIndicator: { position: "absolute", left: 0, top: 0, bottom: 0, width: 3, backgroundColor: Colors.accent },
  programTime: { width: 70, alignItems: "flex-end", gap: 1 },
  programTimeText: { fontSize: 12, fontFamily: "Inter_700Bold", color: Colors.text },
  programEndTime: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  programDuration: { fontSize: 9, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  programInfo: { flex: 1 },
  programTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 3 },
  programTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.text, flexShrink: 1 },
  nowBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.danger, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  nowDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#fff" },
  nowText: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 0.5 },
  categoryChip: { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  categoryText: { fontSize: 9, fontFamily: "Inter_600SemiBold" },
  programDesc: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  progressBar: { marginTop: 4, height: 3, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 2, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: Colors.accent, borderRadius: 2 },
  watchBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: Colors.accent, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  watchBtnText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#fff" },
  watchBtnDisabled: { width: 36, height: 36, borderRadius: 8, backgroundColor: Colors.card, alignItems: "center", justifyContent: "center" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 20, fontFamily: "Inter_600SemiBold", color: Colors.text },
  emptySubtitle: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textMuted, textAlign: "center", lineHeight: 22 },
});
