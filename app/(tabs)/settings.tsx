import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useIPTV } from "@/context/IPTVContext";
import Colors from "@/constants/colors";
import * as Haptics from "expo-haptics";

type PlayerType = "default" | "exoplayer" | "vlc";
type StreamType = "auto" | "hls" | "mpegts";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { userInfo, loginType, credentials, clearHistory, refreshContent, logout } = useIPTV();

  const [playerType, setPlayerType] = useState<PlayerType>("default");
  const [streamType, setStreamType] = useState<StreamType>("auto");
  const [hardwareDecode, setHardwareDecode] = useState(true);
  const [autoReconnect, setAutoReconnect] = useState(true);
  const [use24h, setUse24h] = useState(false);
  const [parentalEnabled, setParentalEnabled] = useState(false);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : 0;

  const handleLogout = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out? Your favorites will be lost.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            logout();
            router.replace("/login");
          },
        },
      ]
    );
  };

  const handleClearCache = () => {
    Alert.alert(
      "Clear Cache",
      "This will clear your watch history and cached data.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => {
            clearHistory();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert("Done", "Cache cleared successfully.");
          },
        },
      ]
    );
  };

  const handleRefresh = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await refreshContent();
      Alert.alert("Updated", "Content refreshed successfully.");
    } catch {
      Alert.alert("Error", "Failed to refresh content.");
    }
  };

  const getAccountInfo = () => {
    if (!loginType) return "Not connected";
    const typeLabel = loginType === "xtream" ? "Xtream Codes" : loginType === "m3u" ? "M3U Playlist" : "Stalker Portal";
    return `${typeLabel}${userInfo?.username ? ` · ${userInfo.username}` : ""}`;
  };

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPadding + 100 }]}
      >
        <SectionHeader title="Account" />
        <View style={styles.section}>
          <InfoRow label="Connection" value={getAccountInfo()} />
          {userInfo?.expDate && userInfo.expDate !== "N/A" && (
            <InfoRow label="Expires" value={userInfo.expDate} />
          )}
          <SettingsRow
            icon="refresh-outline"
            label="Update Contents"
            onPress={handleRefresh}
          />
        </View>

        <SectionHeader title="Player" />
        <View style={styles.section}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons name="play-circle-outline" size={20} color={Colors.accent} />
              <Text style={styles.rowLabel}>Player</Text>
            </View>
            <View style={styles.segmentRow}>
              {(["default", "exoplayer", "vlc"] as PlayerType[]).map((p) => (
                <Pressable
                  key={p}
                  style={[styles.segment, playerType === p && styles.segmentActive]}
                  onPress={() => { setPlayerType(p); Haptics.selectionAsync(); }}
                >
                  <Text style={[styles.segmentText, playerType === p && styles.segmentTextActive]}>
                    {p === "default" ? "Default" : p === "exoplayer" ? "ExoPlayer" : "VLC"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons name="wifi-outline" size={20} color={Colors.accent} />
              <Text style={styles.rowLabel}>Stream Type</Text>
            </View>
            <View style={styles.segmentRow}>
              {(["auto", "hls", "mpegts"] as StreamType[]).map((s) => (
                <Pressable
                  key={s}
                  style={[styles.segment, streamType === s && styles.segmentActive]}
                  onPress={() => { setStreamType(s); Haptics.selectionAsync(); }}
                >
                  <Text style={[styles.segmentText, streamType === s && styles.segmentTextActive]}>
                    {s.toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <ToggleRow
            icon="hardware-chip-outline"
            label="Hardware Decoding"
            value={hardwareDecode}
            onToggle={(v) => { setHardwareDecode(v); Haptics.selectionAsync(); }}
          />
          <ToggleRow
            icon="reload-outline"
            label="Auto Reconnect"
            value={autoReconnect}
            onToggle={(v) => { setAutoReconnect(v); Haptics.selectionAsync(); }}
          />
        </View>

        <SectionHeader title="Preferences" />
        <View style={styles.section}>
          <ToggleRow
            icon="time-outline"
            label="24-Hour Format"
            value={use24h}
            onToggle={(v) => { setUse24h(v); Haptics.selectionAsync(); }}
          />
          <ToggleRow
            icon="lock-closed-outline"
            label="Parental Control"
            value={parentalEnabled}
            onToggle={(v) => { setParentalEnabled(v); Haptics.selectionAsync(); }}
          />
        </View>

        <SectionHeader title="Data" />
        <View style={styles.section}>
          <SettingsRow icon="trash-outline" label="Clear Cache" onPress={handleClearCache} danger />
        </View>

        <SectionHeader title="Legal" />
        <View style={styles.section}>
          <SettingsRow
            icon="shield-checkmark-outline"
            label="Privacy Policy"
            onPress={() => router.push("/privacy")}
          />
          <SettingsRow
            icon="document-text-outline"
            label="Terms of Service"
            onPress={() => router.push("/terms")}
          />
        </View>

        <SectionHeader title="App" />
        <View style={styles.section}>
          <InfoRow label="Version" value="1.0.0" />
          <InfoRow label="Build" value="OTTMEGA IPTV" />
        </View>

        <View style={styles.disclaimer}>
          <Ionicons name="information-circle-outline" size={14} color={Colors.textMuted} />
          <Text style={styles.disclaimerText}>
            This app does not provide any TV channels or content. Users must provide their own playlists. The developer is not responsible for the content streamed by users.
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [styles.signOutBtn, pressed && { opacity: 0.8 }]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function SettingsRow({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
      onPress={onPress}
    >
      <View style={styles.rowLeft}>
        <Ionicons name={icon} size={20} color={danger ? Colors.danger : Colors.accent} />
        <Text style={[styles.rowLabel, danger && { color: Colors.danger }]}>{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
    </Pressable>
  );
}

function ToggleRow({
  icon,
  label,
  value,
  onToggle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Ionicons name={icon} size={20} color={Colors.accent} />
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: Colors.cardBorder, true: Colors.accentSoft }}
        thumbColor={value ? Colors.accent : Colors.textMuted}
      />
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  scroll: {
    paddingHorizontal: 20,
  },
  sectionHeader: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textMuted,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 20,
    marginBottom: 8,
  },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  rowLabel: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
  },
  rowValue: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    maxWidth: 180,
    textAlign: "right",
  },
  segmentRow: {
    flexDirection: "row",
    backgroundColor: Colors.card,
    borderRadius: 8,
    padding: 2,
    gap: 2,
  },
  segment: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  segmentActive: {
    backgroundColor: Colors.accent,
  },
  segmentText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
  },
  segmentTextActive: {
    color: "#fff",
  },
  disclaimer: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginTop: 20,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    lineHeight: 16,
  },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 20,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: Colors.danger + "18",
    borderWidth: 1,
    borderColor: Colors.danger + "40",
  },
  signOutText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.danger,
  },
});
