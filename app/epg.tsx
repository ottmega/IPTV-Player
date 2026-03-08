import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ScrollView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useIPTV } from "@/context/IPTVContext";
import Colors from "@/constants/colors";
import * as Haptics from "expo-haptics";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function formatHour(h: number, use24: boolean) {
  if (use24) return `${String(h).padStart(2, "0")}:00`;
  const period = h < 12 ? "AM" : "PM";
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour}:00 ${period}`;
}

function formatDate(d: Date) {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

const MOCK_PROGRAMS = [
  { id: "p1", start: 0, duration: 60, title: "Morning News", description: "Daily morning news broadcast" },
  { id: "p2", start: 60, duration: 30, title: "Weather Report", description: "National weather forecast" },
  { id: "p3", start: 90, duration: 120, title: "Documentary: Ocean", description: "Deep sea exploration documentary" },
  { id: "p4", start: 210, duration: 60, title: "Talk Show", description: "Celebrity interviews and discussions" },
  { id: "p5", start: 270, duration: 90, title: "Sports Highlights", description: "Best plays from last night" },
  { id: "p6", start: 360, duration: 120, title: "Action Movie", description: "Blockbuster action film" },
  { id: "p7", start: 480, duration: 60, title: "Evening News", description: "Evening news roundup" },
  { id: "p8", start: 540, duration: 30, title: "Comedy Special", description: "Stand-up comedy hour" },
  { id: "p9", start: 570, duration: 90, title: "Drama Series", description: "Prime time drama episode" },
  { id: "p10", start: 660, duration: 120, title: "Late Night Movie", description: "Feature film presentation" },
];

const HOUR_WIDTH = 140;
const CHANNEL_COL = 80;

export default function EPGScreen() {
  const insets = useSafeAreaInsets();
  const { channels } = useIPTV();
  const [use24h, setUse24h] = useState(false);
  const [selectedDate, setSelectedDate] = useState(0);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i - 2);
    return d;
  });

  const channelsToShow = channels.slice(0, 20);

  const currentHour = new Date().getHours();
  const currentMinute = new Date().getMinutes();

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.title}>TV Guide</Text>
        <Pressable
          style={styles.headerBtn}
          onPress={() => { setUse24h((v) => !v); Haptics.selectionAsync(); }}
        >
          <Text style={styles.timeFormatBtn}>{use24h ? "24H" : "12H"}</Text>
        </Pressable>
      </View>

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

      <View style={{ flex: 1 }}>
        <View style={styles.timelineHeader}>
          <View style={{ width: CHANNEL_COL }} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} scrollEnabled={false}>
            <View style={styles.timeRow}>
              {HOURS.map((h) => (
                <View key={h} style={styles.hourLabel}>
                  <Text style={styles.hourText}>{formatHour(h, use24h)}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>

        {channelsToShow.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No EPG Data</Text>
            <Text style={styles.emptySubtitle}>Connect a playlist to view the TV guide</Text>
          </View>
        ) : (
          <ScrollView>
            {channelsToShow.map((channel) => (
              <View key={channel.streamId} style={styles.epgRow}>
                <View style={styles.channelCol}>
                  <Text style={styles.channelName} numberOfLines={2}>{channel.name}</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.programsRow}>
                    {MOCK_PROGRAMS.map((prog) => {
                      const isNow = prog.start <= currentHour * 60 + currentMinute && prog.start + prog.duration > currentHour * 60 + currentMinute;
                      return (
                        <Pressable
                          key={prog.id}
                          style={[
                            styles.programBlock,
                            { width: (prog.duration / 60) * HOUR_WIDTH - 4 },
                            isNow && styles.programBlockNow,
                          ]}
                          onPress={() => Haptics.selectionAsync()}
                        >
                          <Text style={styles.programTitle} numberOfLines={1}>{prog.title}</Text>
                          <Text style={styles.programTime} numberOfLines={1}>
                            {formatHour(Math.floor(prog.start / 60), use24h)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            ))}
            <View style={{ height: bottomPadding + 100 }} />
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  headerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  timeFormatBtn: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.accent,
  },
  datesRow: {
    maxHeight: 44,
    marginBottom: 12,
  },
  datesContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  dateChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  dateChipActive: {
    backgroundColor: Colors.accentSoft,
    borderColor: Colors.accent,
  },
  dateText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  dateTextActive: {
    color: Colors.accent,
  },
  timelineHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
  },
  timeRow: {
    flexDirection: "row",
  },
  hourLabel: {
    width: HOUR_WIDTH,
    paddingLeft: 8,
  },
  hourText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  epgRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    minHeight: 56,
  },
  channelCol: {
    width: CHANNEL_COL,
    padding: 8,
    justifyContent: "center",
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  channelName: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  programsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    gap: 4,
    paddingLeft: 8,
  },
  programBlock: {
    backgroundColor: Colors.card,
    borderRadius: 8,
    padding: 8,
    height: 44,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  programBlockNow: {
    backgroundColor: Colors.accentSoft,
    borderColor: Colors.accent,
  },
  programTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  programTime: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    marginTop: 2,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
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
