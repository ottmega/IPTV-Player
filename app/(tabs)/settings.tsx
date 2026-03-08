import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Alert,
  Platform,
  Modal,
  TextInput,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useIPTV, XtreamCredentials } from "@/context/IPTVContext";
import Colors from "@/constants/colors";
import * as Haptics from "expo-haptics";

type PlayerType = "default" | "exoplayer" | "vlc";
type StreamType = "auto" | "hls" | "mpegts";
const LANGUAGES = ["English", "Arabic", "Hindi", "Chinese", "French", "Spanish"];

const DEFAULT_PIN = "0000";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { userInfo, loginType, credentials, channels, movies, series, clearHistory, refreshContent, logout, history } = useIPTV();

  const [playerType, setPlayerType] = useState<PlayerType>("default");
  const [streamType, setStreamType] = useState<StreamType>("auto");
  const [hardwareDecode, setHardwareDecode] = useState(true);
  const [autoReconnect, setAutoReconnect] = useState(true);
  const [use24h, setUse24h] = useState(false);
  const [parentalEnabled, setParentalEnabled] = useState(false);
  const [parentalPin, setParentalPin] = useState(DEFAULT_PIN);
  const [language, setLanguage] = useState("English");
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinAction, setPinAction] = useState<"verify" | "change">("verify");
  const [pinInput, setPinInput] = useState("");
  const [newPin, setNewPin] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;
  const isWide = width >= 700;

  const xtreamCreds = loginType === "xtream" ? (credentials as XtreamCredentials) : null;

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
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
    ]);
  };

  const handleClearCache = () => {
    Alert.alert("Clear Cache", "This will clear your watch history and cached data.", [
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
    ]);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await refreshContent();
      Alert.alert("Updated", "Content refreshed successfully.");
    } catch {
      Alert.alert("Error", "Failed to refresh content.");
    } finally {
      setRefreshing(false);
    }
  };

  const openPinModal = (action: "verify" | "change") => {
    setPinAction(action);
    setPinInput("");
    setNewPin("");
    setShowPinModal(true);
  };

  const handlePinSubmit = () => {
    if (pinAction === "verify") {
      if (pinInput === parentalPin) {
        setParentalEnabled(true);
        setShowPinModal(false);
        Alert.alert("Enabled", "Parental control is now active.");
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert("Wrong PIN", "The PIN you entered is incorrect.");
      }
    } else {
      if (pinInput !== parentalPin) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert("Wrong PIN", "Current PIN is incorrect.");
        return;
      }
      if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
        Alert.alert("Invalid PIN", "New PIN must be 4 digits.");
        return;
      }
      setParentalPin(newPin);
      setShowPinModal(false);
      Alert.alert("PIN Changed", "Your parental control PIN has been updated.");
    }
  };

  const getConnectionLabel = () => {
    if (!loginType) return "Not connected";
    if (loginType === "xtream") return "Xtream Codes";
    if (loginType === "m3u") return "M3U Playlist";
    return "Stalker Portal";
  };

  const formatExpiry = () => {
    if (!userInfo?.expDate || userInfo.expDate === "N/A") return "No expiry";
    try {
      const d = new Date(Number(userInfo.expDate) * 1000);
      if (isNaN(d.getTime())) return userInfo.expDate;
      return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    } catch {
      return userInfo.expDate;
    }
  };

  const columns = isWide ? 2 : 1;

  const sections = [
    {
      key: "account",
      content: (
        <>
          <SectionTitle icon="person-circle-outline" title="Account" />
          <Card>
            <InfoRow icon="server-outline" label="Connection" value={getConnectionLabel()} />
            {userInfo?.username && <InfoRow icon="at-outline" label="Username" value={userInfo.username} />}
            {xtreamCreds && <InfoRow icon="globe-outline" label="Server" value={xtreamCreds.serverUrl} />}
            {userInfo?.maxConnections && <InfoRow icon="people-outline" label="Max Connections" value={userInfo.maxConnections} />}
            {userInfo?.expDate && <InfoRow icon="calendar-outline" label="Expires" value={formatExpiry()} />}
            {userInfo?.status && <InfoRow icon="checkmark-circle-outline" label="Status" value={userInfo.status} color={userInfo.status === "Active" ? Colors.success : Colors.danger} />}
            {userInfo?.message && <InfoRow icon="chatbox-outline" label="Message" value={userInfo.message} />}
          </Card>

          <SectionTitle icon="stats-chart-outline" title="Content Stats" />
          <Card>
            <InfoRow icon="tv-outline" label="Live Channels" value={String(channels.length)} />
            <InfoRow icon="film-outline" label="Movies" value={String(movies.length)} />
            <InfoRow icon="play-circle-outline" label="Series" value={String(series.length)} />
            <InfoRow icon="time-outline" label="Watched" value={String(history.length)} />
          </Card>
        </>
      ),
    },
    {
      key: "player",
      content: (
        <>
          <SectionTitle icon="play-circle-outline" title="Player" />
          <Card>
            <SegmentRow
              icon="play-circle-outline"
              label="Engine"
              options={[
                { value: "default", label: "Default" },
                { value: "exoplayer", label: "ExoPlayer" },
                { value: "vlc", label: "VLC" },
              ]}
              active={playerType}
              onSelect={(v) => setPlayerType(v as PlayerType)}
            />
            <SegmentRow
              icon="wifi-outline"
              label="Stream Type"
              options={[
                { value: "auto", label: "AUTO" },
                { value: "hls", label: "HLS" },
                { value: "mpegts", label: "MPEG-TS" },
              ]}
              active={streamType}
              onSelect={(v) => setStreamType(v as StreamType)}
            />
            <ToggleRow icon="hardware-chip-outline" label="Hardware Decoding" value={hardwareDecode} onToggle={setHardwareDecode} />
            <ToggleRow icon="reload-outline" label="Auto Reconnect" value={autoReconnect} onToggle={setAutoReconnect} />
          </Card>
        </>
      ),
    },
    {
      key: "preferences",
      content: (
        <>
          <SectionTitle icon="options-outline" title="Preferences" />
          <Card>
            <ToggleRow icon="time-outline" label="24-Hour Format" value={use24h} onToggle={setUse24h} />
            <ActionRow
              icon="language-outline"
              label="Language"
              value={language}
              onPress={() => setShowLangPicker(true)}
            />
          </Card>

          <SectionTitle icon="lock-closed-outline" title="Parental Control" />
          <Card>
            <ToggleRow
              icon="shield-outline"
              label="Parental Control"
              value={parentalEnabled}
              onToggle={(v) => {
                if (v) {
                  openPinModal("verify");
                } else {
                  setParentalEnabled(false);
                }
              }}
            />
            <ActionRow icon="keypad-outline" label="Change PIN" value="" onPress={() => openPinModal("change")} />
            <View style={styles.pinHint}>
              <Ionicons name="information-circle-outline" size={13} color={Colors.textMuted} />
              <Text style={styles.pinHintText}>Default PIN: 0000</Text>
            </View>
          </Card>
        </>
      ),
    },
    {
      key: "tools",
      content: (
        <>
          <SectionTitle icon="construct-outline" title="Tools" />
          <Card>
            <ActionRow icon="flash-outline" label="Speed Test" value="" onPress={() => router.push("/speedtest")} />
            <ActionRow
              icon="refresh-outline"
              label={refreshing ? "Updating..." : "Update Contents"}
              value=""
              onPress={handleRefresh}
              loading={refreshing}
            />
            <ActionRow icon="trash-outline" label="Clear Cache" value="" onPress={handleClearCache} danger />
          </Card>

          <SectionTitle icon="document-text-outline" title="Legal" />
          <Card>
            <ActionRow icon="shield-checkmark-outline" label="Privacy Policy" value="" onPress={() => router.push("/privacy")} />
            <ActionRow icon="document-text-outline" label="Terms of Service" value="" onPress={() => router.push("/terms")} />
          </Card>

          <SectionTitle icon="information-circle-outline" title="App Info" />
          <Card>
            <InfoRow icon="phone-portrait-outline" label="App Name" value="OTTMEGA IPTV" />
            <InfoRow icon="code-slash-outline" label="Version" value="2.0.0" />
            <InfoRow icon="construct-outline" label="Build" value="Release" />
          </Card>
        </>
      ),
    },
  ];

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.pageHeader}>
        <LinearGradient colors={[Colors.gradient1, Colors.gradient2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.pageHeaderIcon}>
          <Ionicons name="settings" size={18} color="#fff" />
        </LinearGradient>
        <Text style={styles.pageTitle}>Settings</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPadding + 100 }]}
      >
        {isWide ? (
          <View style={styles.twoCol}>
            <View style={styles.col}>
              {sections[0].content}
              {sections[2].content}
            </View>
            <View style={styles.col}>
              {sections[1].content}
              {sections[3].content}
            </View>
          </View>
        ) : (
          <>
            {sections.map((s) => <View key={s.key}>{s.content}</View>)}
          </>
        )}

        <View style={styles.disclaimer}>
          <Ionicons name="information-circle-outline" size={14} color={Colors.textMuted} />
          <Text style={styles.disclaimerText}>
            This app does not provide any TV channels or content. Users must connect their own IPTV subscription. The developer is not responsible for any content streamed through this app.
          </Text>
        </View>

        <Pressable style={({ pressed }) => [styles.signOutBtn, pressed && { opacity: 0.8 }]} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={showLangPicker} transparent animationType="fade" onRequestClose={() => setShowLangPicker(false)}>
        <Pressable style={styles.modalBg} onPress={() => setShowLangPicker(false)}>
          <View style={styles.picker} onStartShouldSetResponder={() => true}>
            <Text style={styles.pickerTitle}>Select Language</Text>
            {LANGUAGES.map((lang) => (
              <Pressable
                key={lang}
                style={[styles.pickerItem, language === lang && styles.pickerItemActive]}
                onPress={() => { setLanguage(lang); setShowLangPicker(false); Haptics.selectionAsync(); }}
              >
                <Text style={[styles.pickerItemText, language === lang && styles.pickerItemTextActive]}>{lang}</Text>
                {language === lang && <Ionicons name="checkmark-circle" size={18} color={Colors.accent} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      <Modal visible={showPinModal} transparent animationType="slide" onRequestClose={() => setShowPinModal(false)}>
        <View style={styles.modalBg}>
          <View style={styles.pinModal}>
            <Text style={styles.pinModalTitle}>
              {pinAction === "verify" ? "Enter Parental PIN" : "Change PIN"}
            </Text>
            <Text style={styles.pinModalSub}>
              {pinAction === "verify" ? "Enter your 4-digit PIN to enable parental control" : "Enter current PIN, then new 4-digit PIN"}
            </Text>
            <View style={styles.pinInput}>
              <Ionicons name="keypad-outline" size={18} color={Colors.textMuted} />
              <TextInput
                style={styles.pinField}
                placeholder="Current PIN"
                placeholderTextColor={Colors.textMuted}
                value={pinInput}
                onChangeText={setPinInput}
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry
                autoFocus
              />
            </View>
            {pinAction === "change" && (
              <View style={styles.pinInput}>
                <Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} />
                <TextInput
                  style={styles.pinField}
                  placeholder="New PIN (4 digits)"
                  placeholderTextColor={Colors.textMuted}
                  value={newPin}
                  onChangeText={setNewPin}
                  keyboardType="number-pad"
                  maxLength={4}
                  secureTextEntry
                />
              </View>
            )}
            <View style={styles.pinActions}>
              <Pressable style={styles.pinCancelBtn} onPress={() => setShowPinModal(false)}>
                <Text style={styles.pinCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.pinConfirmBtn} onPress={handlePinSubmit}>
                <LinearGradient colors={[Colors.gradient1, Colors.gradient2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.pinConfirmGrad}>
                  <Text style={styles.pinConfirmText}>Confirm</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SectionTitle({ icon, title }: { icon: keyof typeof Ionicons.glyphMap; title: string }) {
  return (
    <View style={styles.sectionTitle}>
      <Ionicons name={icon} size={14} color={Colors.accent} />
      <Text style={styles.sectionTitleText}>{title}</Text>
    </View>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function InfoRow({ icon, label, value, color }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; color?: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Ionicons name={icon} size={17} color={Colors.accent} />
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <Text style={[styles.rowValue, color && { color }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function ActionRow({ icon, label, value, onPress, danger, loading }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; value: string; onPress: () => void; danger?: boolean; loading?: boolean;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]} onPress={onPress}>
      <View style={styles.rowLeft}>
        <Ionicons name={icon} size={17} color={danger ? Colors.danger : Colors.accent} />
        <Text style={[styles.rowLabel, danger && { color: Colors.danger }]}>{label}</Text>
      </View>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {loading ? (
        <Ionicons name="reload-outline" size={16} color={Colors.textMuted} />
      ) : (
        <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
      )}
    </Pressable>
  );
}

function ToggleRow({ icon, label, value, onToggle }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; value: boolean; onToggle: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Ionicons name={icon} size={17} color={Colors.accent} />
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={(v) => { onToggle(v); Haptics.selectionAsync(); }}
        trackColor={{ false: Colors.cardBorder, true: Colors.accentSoft }}
        thumbColor={value ? Colors.accent : Colors.textMuted}
      />
    </View>
  );
}

function SegmentRow({ icon, label, options, active, onSelect }: {
  icon: keyof typeof Ionicons.glyphMap; label: string;
  options: { value: string; label: string }[];
  active: string; onSelect: (v: string) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Ionicons name={icon} size={17} color={Colors.accent} />
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <View style={styles.segmentRow}>
        {options.map((opt) => (
          <Pressable
            key={opt.value}
            style={[styles.segment, active === opt.value && styles.segmentActive]}
            onPress={() => { onSelect(opt.value); Haptics.selectionAsync(); }}
          >
            <Text style={[styles.segmentText, active === opt.value && styles.segmentTextActive]}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  pageHeader: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingBottom: 12 },
  pageHeaderIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  pageTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.text },
  scroll: { paddingHorizontal: 16 },
  twoCol: { flexDirection: "row", gap: 16 },
  col: { flex: 1 },
  sectionTitle: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 18, marginBottom: 8 },
  sectionTitleText: { fontSize: 11, fontFamily: "Inter_700Bold", color: Colors.textMuted, letterSpacing: 1.2, textTransform: "uppercase" },
  card: { backgroundColor: Colors.surface, borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: Colors.cardBorder },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  rowLabel: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.text },
  rowValue: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary, maxWidth: 160, textAlign: "right" },
  segmentRow: { flexDirection: "row", backgroundColor: Colors.card, borderRadius: 8, padding: 2, gap: 2 },
  segment: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6 },
  segmentActive: { backgroundColor: Colors.accent },
  segmentText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: Colors.textMuted },
  segmentTextActive: { color: "#fff" },
  pinHint: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 10 },
  pinHintText: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  disclaimer: { flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: Colors.surface, borderRadius: 12, padding: 14, marginTop: 20, borderWidth: 1, borderColor: Colors.cardBorder },
  disclaimerText: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted, lineHeight: 16 },
  signOutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 16, paddingVertical: 16, borderRadius: 14, backgroundColor: Colors.danger + "18", borderWidth: 1, borderColor: Colors.danger + "40" },
  signOutText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.danger },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center", padding: 24 },
  picker: { width: "100%", maxWidth: 320, backgroundColor: Colors.surface, borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: Colors.cardBorder },
  pickerTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.text, padding: 18, borderBottomWidth: 1, borderBottomColor: Colors.border },
  pickerItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  pickerItemActive: { backgroundColor: Colors.accentSoft },
  pickerItemText: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.text },
  pickerItemTextActive: { color: Colors.accent },
  pinModal: { width: "100%", maxWidth: 340, backgroundColor: Colors.surface, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: Colors.cardBorder, gap: 16 },
  pinModalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text },
  pinModalSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, lineHeight: 18 },
  pinInput: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.card, borderRadius: 10, paddingHorizontal: 14, height: 48, borderWidth: 1, borderColor: Colors.cardBorder },
  pinField: { flex: 1, fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text, letterSpacing: 8 },
  pinActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  pinCancelBtn: { flex: 1, height: 46, borderRadius: 12, backgroundColor: Colors.card, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.cardBorder },
  pinCancelText: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  pinConfirmBtn: { flex: 1, borderRadius: 12, overflow: "hidden" },
  pinConfirmGrad: { height: 46, alignItems: "center", justifyContent: "center" },
  pinConfirmText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
