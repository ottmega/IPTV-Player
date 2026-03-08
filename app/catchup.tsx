import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useIPTV } from "@/context/IPTVContext";
import Colors from "@/constants/colors";
import * as Haptics from "expo-haptics";

const DAYS = [-3, -2, -1, 0].map((offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d;
});

function formatDay(d: Date) {
  if (d.toDateString() === new Date().toDateString()) return "Today";
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function CatchUpScreen() {
  const insets = useSafeAreaInsets();
  const { channels } = useIPTV();
  const [selectedDay, setSelectedDay] = useState(0);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  const archiveChannels = channels.filter((c) => c.tvArchive === 1);

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.title}>Catch Up</Text>
      </View>

      <View style={styles.info}>
        <Ionicons name="information-circle-outline" size={16} color={Colors.accent} />
        <Text style={styles.infoText}>
          Catch-Up lets you replay past programs. Only available for channels with archive support.
        </Text>
      </View>

      <FlatList
        horizontal
        data={DAYS}
        keyExtractor={(_, i) => String(i)}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.daysList}
        renderItem={({ item, index }) => (
          <Pressable
            style={[styles.dayChip, selectedDay === index && styles.dayChipActive]}
            onPress={() => { setSelectedDay(index); Haptics.selectionAsync(); }}
          >
            <Text style={[styles.dayText, selectedDay === index && styles.dayTextActive]}>
              {formatDay(item)}
            </Text>
          </Pressable>
        )}
      />

      {archiveChannels.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="time-outline" size={56} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No Catch-Up Available</Text>
          <Text style={styles.emptySubtitle}>
            Catch-Up requires channels with TV archive support enabled. This depends on your IPTV provider.
          </Text>
        </View>
      ) : (
        <FlatList
          data={archiveChannels}
          keyExtractor={(c) => c.streamId}
          contentContainerStyle={[styles.list, { paddingBottom: bottomPadding + 100 }]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.channelRow, pressed && { opacity: 0.75 }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({ pathname: "/epg" });
              }}
            >
              <View style={styles.channelLogo}>
                {item.streamIcon ? (
                  <Image source={{ uri: item.streamIcon }} style={{ width: 32, height: 32 }} resizeMode="contain" />
                ) : (
                  <Ionicons name="tv" size={20} color={Colors.textMuted} />
                )}
              </View>
              <View style={styles.channelInfo}>
                <Text style={styles.channelName} numberOfLines={1}>{item.name}</Text>
                <View style={styles.archiveBadge}>
                  <Ionicons name="time" size={10} color={Colors.success} />
                  <Text style={styles.archiveText}>Archive Available</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </Pressable>
          )}
        />
      )}
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
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  info: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: Colors.accentSoft,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.accent + "40",
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  daysList: {
    paddingHorizontal: 20,
    gap: 8,
    paddingBottom: 16,
  },
  dayChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  dayChipActive: {
    backgroundColor: Colors.accentSoft,
    borderColor: Colors.accent,
  },
  dayText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  dayTextActive: {
    color: Colors.accent,
  },
  list: {
    paddingHorizontal: 20,
    gap: 6,
  },
  channelRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: 6,
  },
  channelLogo: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  channelInfo: {
    flex: 1,
  },
  channelName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    marginBottom: 4,
  },
  archiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  archiveText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.success,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
    lineHeight: 22,
  },
});
