import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Switch,
  Alert,
  Platform,
  ActivityIndicator,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { getApiUrl } from "@/lib/query-client";
import Colors from "@/constants/colors";
import * as Haptics from "expo-haptics";
import type { AppConfig } from "@/context/RemoteConfigContext";

const PRESET_COLORS = [
  "#4F8EF7", "#7C3AED", "#10B981", "#F59E0B",
  "#EF4444", "#EC4899", "#06B6D4", "#F97316",
];

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const [adminKey, setAdminKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [pushTitle, setPushTitle] = useState("");
  const [pushBody, setPushBody] = useState("");
  const [pushSending, setPushSending] = useState(false);
  const [pushResult, setPushResult] = useState("");
  const [analytics, setAnalytics] = useState<any>(null);
  const [pushStats, setPushStats] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"config" | "push" | "analytics">("config");

  const [config, setConfig] = useState<AppConfig>({
    logo: "",
    banner: "",
    bannerTitle: "Visit OTTMEGA Website",
    bannerLink: "https://ottmega.in",
    showBanner: false,
    bannerStartDate: "",
    bannerEndDate: "",
    announcement: "",
    themeColor: "#4F8EF7",
    minAppVersion: "",
    updateUrl: "",
    forceUpdate: false,
  });

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const sidePad = Platform.OS === "web" ? 24 : 16;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const apiBase = getApiUrl();

  const verify = async () => {
    if (!adminKey.trim()) return;
    setAuthLoading(true);
    try {
      const url = new URL(`/api/admin/verify?key=${encodeURIComponent(adminKey.trim())}`, apiBase).toString();
      const res = await fetch(url, { credentials: "include" });
      const data = await res.json();
      if (data.valid) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setAuthed(true);
        loadConfig();
        loadAnalytics();
        loadPushStats();
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert("Access Denied", "Invalid admin key.");
      }
    } catch {
      Alert.alert("Error", "Could not connect to server.");
    } finally {
      setAuthLoading(false);
    }
  };

  const loadConfig = useCallback(async () => {
    setLoadingConfig(true);
    try {
      const url = new URL("/api/app-config", apiBase).toString();
      const res = await fetch(url, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setConfig((p) => ({ ...p, ...data }));
      }
    } catch {}
    setLoadingConfig(false);
  }, [apiBase]);

  const loadAnalytics = useCallback(async () => {
    try {
      const url = new URL("/api/analytics", apiBase).toString();
      const res = await fetch(url, { credentials: "include", headers: { "x-admin-key": adminKey } });
      if (res.ok) setAnalytics(await res.json());
    } catch {}
  }, [apiBase, adminKey]);

  const loadPushStats = useCallback(async () => {
    try {
      const url = new URL("/api/push/stats", apiBase).toString();
      const res = await fetch(url, { credentials: "include", headers: { "x-admin-key": adminKey } });
      if (res.ok) setPushStats(await res.json());
    } catch {}
  }, [apiBase, adminKey]);

  const saveConfig = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const url = new URL("/api/app-config", apiBase).toString();
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        credentials: "include",
        body: JSON.stringify({ ...config, adminKey }),
      });
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        Alert.alert("Error", "Failed to save config.");
      }
    } catch {
      Alert.alert("Error", "Network error.");
    } finally {
      setSaving(false);
    }
  };

  const sendPush = async () => {
    if (!pushTitle.trim() || !pushBody.trim()) {
      Alert.alert("Missing Fields", "Please enter both title and message.");
      return;
    }
    setPushSending(true);
    setPushResult("");
    try {
      const url = new URL("/api/push/send", apiBase).toString();
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        credentials: "include",
        body: JSON.stringify({ title: pushTitle, body: pushBody }),
      });
      const data = await res.json();
      if (data.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setPushResult(`Sent to ${data.sent} device${data.sent !== 1 ? "s" : ""}${data.message ? ` — ${data.message}` : ""}`);
        setPushTitle("");
        setPushBody("");
        loadPushStats();
      } else {
        setPushResult("Failed to send notifications.");
      }
    } catch {
      setPushResult("Network error.");
    } finally {
      setPushSending(false);
    }
  };

  const update = (field: keyof AppConfig, value: string | boolean) =>
    setConfig((p) => ({ ...p, [field]: value }));

  if (!authed) {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <LinearGradient colors={["#05051A", "#0A0520", "#06061A"]} style={StyleSheet.absoluteFill} />
        <Pressable style={[styles.backBtn, { position: "absolute", top: topPad + 8, left: sidePad }]} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </Pressable>
        <View style={styles.authCenter}>
          <LinearGradient colors={[Colors.gradient1, Colors.gradient2]} style={styles.authLogoBox} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Ionicons name="shield-checkmark" size={28} color="#fff" />
          </LinearGradient>
          <Text style={styles.authTitle}>Admin Dashboard</Text>
          <Text style={styles.authSub}>OTTMEGA IPTV Control Panel</Text>
          <View style={[styles.authCard, { width: "100%", maxWidth: 380 }]}>
            <Text style={styles.authCardTitle}>Sign In Required</Text>
            <Text style={styles.authCardDesc}>Enter your admin key to access dashboard controls.</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Admin Key</Text>
              <View style={styles.inputRow}>
                <Ionicons name="key-outline" size={16} color={Colors.textMuted} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  value={adminKey}
                  onChangeText={setAdminKey}
                  placeholder="Enter admin key..."
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry={!showKey}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onSubmitEditing={verify}
                  returnKeyType="done"
                />
                <Pressable onPress={() => setShowKey(!showKey)} style={{ padding: 6 }}>
                  <Ionicons name={showKey ? "eye-off-outline" : "eye-outline"} size={16} color={Colors.textMuted} />
                </Pressable>
              </View>
            </View>
            <Pressable
              style={({ pressed }) => [styles.signInBtn, pressed && { opacity: 0.85 }]}
              onPress={verify}
              disabled={authLoading}
            >
              <LinearGradient colors={[Colors.gradient1, Colors.gradient2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.signInBtnGradient}>
                {authLoading ? <ActivityIndicator color="#fff" size="small" /> : (
                  <>
                    <Ionicons name="log-in-outline" size={18} color="#fff" />
                    <Text style={styles.signInBtnText}>Sign In</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <LinearGradient colors={["#070714", "#0A0A18", "#070714"]} style={StyleSheet.absoluteFill} />

      <View style={[styles.header, { paddingHorizontal: sidePad }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Admin Dashboard</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {saved && (
            <View style={styles.savedBadge}>
              <Ionicons name="checkmark-circle" size={13} color={Colors.success} />
              <Text style={styles.savedBadgeText}>Saved</Text>
            </View>
          )}
          {activeTab === "config" && (
            <Pressable style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }]} onPress={saveConfig} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" size="small" /> : (
                <>
                  <Ionicons name="cloud-upload-outline" size={15} color="#fff" />
                  <Text style={styles.saveBtnText}>Save</Text>
                </>
              )}
            </Pressable>
          )}
        </View>
      </View>

      <View style={[styles.tabBar, { paddingHorizontal: sidePad }]}>
        {(["config", "push", "analytics"] as const).map((tab) => (
          <Pressable key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} onPress={() => {
            setActiveTab(tab);
            Haptics.selectionAsync();
            if (tab === "analytics") loadAnalytics();
            if (tab === "push") loadPushStats();
          }}>
            <Ionicons
              name={tab === "config" ? "settings-outline" : tab === "push" ? "notifications-outline" : "bar-chart-outline"}
              size={15}
              color={activeTab === tab ? Colors.accent : Colors.textMuted}
            />
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === "config" ? "Config" : tab === "push" ? "Push" : "Analytics"}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingHorizontal: sidePad, paddingBottom: bottomPad + 24 }]}
      >
        {loadingConfig && activeTab === "config" && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={Colors.accent} size="small" />
            <Text style={styles.loadingText}>Loading config...</Text>
          </View>
        )}

        {activeTab === "config" && (
          <>
            <ConfigSection icon="megaphone-outline" title="Announcement Bar" desc="Scrolling message shown on the home screen. Leave empty to hide." iconBg={Colors.gradient1 + "25"} iconColor={Colors.gradient1}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Message Text</Text>
                <TextInput
                  style={[styles.input, styles.inputBlock, { height: 72 }]}
                  value={config.announcement}
                  onChangeText={(v) => update("announcement", v)}
                  placeholder="e.g. Maintenance tonight at 2 AM"
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  textAlignVertical="top"
                />
              </View>
            </ConfigSection>

            <ConfigSection icon="image-outline" title="Promotional Banner" desc="Clickable image banner with scheduling support." iconBg={Colors.gradient2 + "25"} iconColor={Colors.gradient2}>
              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleLabel}>Show Banner</Text>
                  <Text style={styles.toggleDesc}>Toggle visibility (respects schedule dates)</Text>
                </View>
                <Switch value={config.showBanner} onValueChange={(v) => update("showBanner", v)} trackColor={{ true: Colors.accent, false: Colors.cardBorder }} thumbColor="#fff" />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Banner Image URL</Text>
                <TextInput style={[styles.input, styles.inputBlock]} value={config.banner} onChangeText={(v) => update("banner", v)} placeholder="https://example.com/banner.jpg" placeholderTextColor={Colors.textMuted} keyboardType="url" autoCapitalize="none" autoCorrect={false} />
                {!!config.banner && <Image source={{ uri: config.banner }} style={styles.bannerPreview} resizeMode="cover" />}
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Banner Title</Text>
                <TextInput style={[styles.input, styles.inputBlock]} value={config.bannerTitle} onChangeText={(v) => update("bannerTitle", v)} placeholder="Visit OTTMEGA Website" placeholderTextColor={Colors.textMuted} />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Banner Link URL</Text>
                <TextInput style={[styles.input, styles.inputBlock]} value={config.bannerLink} onChangeText={(v) => update("bannerLink", v)} placeholder="https://ottmega.in" placeholderTextColor={Colors.textMuted} keyboardType="url" autoCapitalize="none" autoCorrect={false} />
              </View>
              <View style={styles.row2}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Start Date</Text>
                  <TextInput style={[styles.input, styles.inputBlock]} value={config.bannerStartDate} onChangeText={(v) => update("bannerStartDate", v)} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textMuted} />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>End Date</Text>
                  <TextInput style={[styles.input, styles.inputBlock]} value={config.bannerEndDate} onChangeText={(v) => update("bannerEndDate", v)} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textMuted} />
                </View>
              </View>
              {(config.bannerStartDate || config.bannerEndDate) && (
                <View style={styles.scheduleBadge}>
                  <Ionicons name="calendar-outline" size={12} color="#F59E0B" />
                  <Text style={styles.scheduleBadgeText}>
                    Scheduled: {config.bannerStartDate || "any"} → {config.bannerEndDate || "any"}
                  </Text>
                </View>
              )}
            </ConfigSection>

            <ConfigSection icon="logo-web-component" title="Custom Logo" desc="Replace the default play icon in the app header." iconBg={Colors.success + "22"} iconColor={Colors.success}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Logo Image URL</Text>
                <TextInput style={[styles.input, styles.inputBlock]} value={config.logo} onChangeText={(v) => update("logo", v)} placeholder="https://example.com/logo.png" placeholderTextColor={Colors.textMuted} keyboardType="url" autoCapitalize="none" autoCorrect={false} />
              </View>
              {!!config.logo && (
                <View style={styles.logoPreviewRow}>
                  <Image source={{ uri: config.logo }} style={styles.logoPreview} resizeMode="cover" />
                  <Text style={styles.logoPreviewLabel}>Shown in app header (32×32)</Text>
                </View>
              )}
            </ConfigSection>

            <ConfigSection icon="color-palette-outline" title="Theme Color" desc="Accent color for buttons, icons, and highlights." iconBg="#F59E0B22" iconColor="#F59E0B">
              <View style={styles.colorPresetRow}>
                {PRESET_COLORS.map((c) => (
                  <Pressable key={c} style={[styles.colorSwatch, { backgroundColor: c }, config.themeColor === c && styles.colorSwatchActive]} onPress={() => { update("themeColor", c); Haptics.selectionAsync(); }} />
                ))}
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Hex Value</Text>
                <View style={styles.inputRow}>
                  <View style={[styles.colorDot, { backgroundColor: config.themeColor }]} />
                  <TextInput style={styles.input} value={config.themeColor} onChangeText={(v) => { if (/^#[0-9a-fA-F]{0,6}$/.test(v)) update("themeColor", v); }} placeholder="#4F8EF7" placeholderTextColor={Colors.textMuted} autoCapitalize="none" maxLength={7} />
                </View>
              </View>
            </ConfigSection>

            <ConfigSection icon="arrow-up-circle-outline" title="Force Update" desc="Show a mandatory update prompt when the app version is below the minimum." iconBg="#EF444422" iconColor="#EF4444">
              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleLabel}>Enable Force Update</Text>
                  <Text style={styles.toggleDesc}>Show update popup on old versions</Text>
                </View>
                <Switch value={config.forceUpdate} onValueChange={(v) => update("forceUpdate", v)} trackColor={{ true: "#EF4444", false: Colors.cardBorder }} thumbColor="#fff" />
              </View>
              <View style={styles.row2}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Min App Version</Text>
                  <TextInput style={[styles.input, styles.inputBlock]} value={config.minAppVersion} onChangeText={(v) => update("minAppVersion", v)} placeholder="1.0.0" placeholderTextColor={Colors.textMuted} autoCapitalize="none" />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Update URL</Text>
                  <TextInput style={[styles.input, styles.inputBlock]} value={config.updateUrl} onChangeText={(v) => update("updateUrl", v)} placeholder="https://play.google.com/..." placeholderTextColor={Colors.textMuted} keyboardType="url" autoCapitalize="none" autoCorrect={false} />
                </View>
              </View>
            </ConfigSection>

            <Pressable style={({ pressed }) => [styles.saveFullBtn, pressed && { opacity: 0.85 }]} onPress={saveConfig} disabled={saving}>
              <LinearGradient colors={[Colors.gradient1, Colors.gradient2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.saveFullBtnGradient}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
                    <Text style={styles.saveFullBtnText}>Save All Changes</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </>
        )}

        {activeTab === "push" && (
          <>
            {pushStats && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionIcon, { backgroundColor: Colors.accent + "22" }]}>
                    <Ionicons name="phone-portrait-outline" size={16} color={Colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sectionTitle}>Registered Devices</Text>
                    <Text style={styles.sectionDesc}>{pushStats.total} device{pushStats.total !== 1 ? "s" : ""} have push notifications enabled</Text>
                  </View>
                </View>
                <View style={styles.statsGrid}>
                  {Object.entries(pushStats.byPlatform || {}).map(([plat, count]) => (
                    <View key={plat} style={styles.statChip}>
                      <Ionicons name={plat === "ios" ? "logo-apple" : plat === "android" ? "logo-android" : "globe-outline"} size={14} color={Colors.textSecondary} />
                      <Text style={styles.statChipText}>{plat}: {count as number}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <ConfigSection icon="notifications-outline" title="Send Push Notification" desc="Send an instant notification to all registered devices." iconBg={Colors.gradient2 + "25"} iconColor={Colors.gradient2}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Notification Title</Text>
                <TextInput style={[styles.input, styles.inputBlock]} value={pushTitle} onChangeText={setPushTitle} placeholder="New Channels Added" placeholderTextColor={Colors.textMuted} />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Message Body</Text>
                <TextInput style={[styles.input, styles.inputBlock, { height: 80 }]} value={pushBody} onChangeText={setPushBody} placeholder="50+ new channels added to your playlist today!" placeholderTextColor={Colors.textMuted} multiline textAlignVertical="top" />
              </View>
              {!!pushResult && (
                <View style={styles.pushResult}>
                  <Ionicons name={pushResult.startsWith("Sent") ? "checkmark-circle" : "alert-circle"} size={14} color={pushResult.startsWith("Sent") ? Colors.success : "#EF4444"} />
                  <Text style={[styles.pushResultText, { color: pushResult.startsWith("Sent") ? Colors.success : "#EF4444" }]}>{pushResult}</Text>
                </View>
              )}
              <Pressable style={({ pressed }) => [styles.saveFullBtn, pressed && { opacity: 0.85 }]} onPress={sendPush} disabled={pushSending}>
                <LinearGradient colors={[Colors.gradient2, Colors.gradient1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.saveFullBtnGradient}>
                  {pushSending ? <ActivityIndicator color="#fff" size="small" /> : (
                    <>
                      <Ionicons name="send-outline" size={18} color="#fff" />
                      <Text style={styles.saveFullBtnText}>Send Notification</Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>
            </ConfigSection>
          </>
        )}

        {activeTab === "analytics" && (
          <>
            {analytics ? (
              <>
                <View style={styles.analyticsGrid}>
                  <AnalyticCard label="Total Opens" value={analytics.totalOpens || 0} icon="open-outline" color={Colors.gradient1} />
                  <AnalyticCard label="Unique Devices" value={analytics.uniqueDevices || 0} icon="phone-portrait-outline" color={Colors.gradient2} />
                </View>

                {analytics.platforms && Object.keys(analytics.platforms).length > 0 && (
                  <ConfigSection icon="pie-chart-outline" title="Platforms" desc="App opens by platform" iconBg={Colors.gradient1 + "22"} iconColor={Colors.gradient1}>
                    {Object.entries(analytics.platforms).map(([plat, cnt]) => (
                      <View key={plat} style={styles.analyticsRow}>
                        <Ionicons name={plat === "ios" ? "logo-apple" : plat === "android" ? "logo-android" : "globe-outline"} size={16} color={Colors.textSecondary} />
                        <Text style={styles.analyticsRowLabel}>{plat}</Text>
                        <Text style={styles.analyticsRowValue}>{cnt as number}</Text>
                      </View>
                    ))}
                  </ConfigSection>
                )}

                {analytics.versions && Object.keys(analytics.versions).length > 0 && (
                  <ConfigSection icon="git-branch-outline" title="App Versions" desc="Opens by version" iconBg={Colors.success + "22"} iconColor={Colors.success}>
                    {Object.entries(analytics.versions).map(([ver, cnt]) => (
                      <View key={ver} style={styles.analyticsRow}>
                        <Ionicons name="code-slash-outline" size={14} color={Colors.textSecondary} />
                        <Text style={styles.analyticsRowLabel}>v{ver}</Text>
                        <Text style={styles.analyticsRowValue}>{cnt as number}</Text>
                      </View>
                    ))}
                  </ConfigSection>
                )}

                {analytics.recentEvents?.length > 0 && (
                  <ConfigSection icon="time-outline" title="Recent Activity" desc="Last 10 app opens" iconBg="#F59E0B22" iconColor="#F59E0B">
                    {(analytics.recentEvents as any[]).slice(0, 10).map((ev: any, i: number) => (
                      <View key={i} style={styles.analyticsRow}>
                        <Ionicons name="radio-button-on-outline" size={12} color={Colors.textMuted} />
                        <Text style={[styles.analyticsRowLabel, { flex: 1 }]} numberOfLines={1}>{ev.ip} · {ev.platform} · v{ev.version}</Text>
                        <Text style={styles.analyticsRowMeta}>{new Date(ev.ts).toLocaleDateString()}</Text>
                      </View>
                    ))}
                  </ConfigSection>
                )}

                {(!analytics.totalOpens) && (
                  <View style={styles.emptyAnalytics}>
                    <Ionicons name="bar-chart-outline" size={32} color={Colors.textMuted} />
                    <Text style={styles.emptyAnalyticsText}>No data yet. Analytics will appear as users open the app.</Text>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={Colors.accent} />
                <Text style={styles.loadingText}>Loading analytics...</Text>
              </View>
            )}
          </>
        )}

        <Pressable style={styles.signOutBtn} onPress={() => setAuthed(false)}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function AnalyticCard({ label, value, icon, color }: { label: string; value: number; icon: keyof typeof Ionicons.glyphMap; color: string }) {
  return (
    <View style={[styles.analyticCard, { borderColor: color + "30" }]}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[styles.analyticValue, { color }]}>{value.toLocaleString()}</Text>
      <Text style={styles.analyticLabel}>{label}</Text>
    </View>
  );
}

function ConfigSection({ icon, title, desc, iconBg, iconColor, children }: {
  icon: keyof typeof Ionicons.glyphMap; title: string; desc: string; iconBg: string; iconColor: string; children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIcon, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={16} color={iconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionDesc}>{desc}</Text>
        </View>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#070714" },
  authCenter: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, gap: 16 },
  authLogoBox: { width: 72, height: 72, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  authTitle: { fontSize: 24, fontFamily: "Inter_700Bold", color: Colors.text },
  authSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary, letterSpacing: 2 },
  authCard: { backgroundColor: Colors.surface + "CC", borderRadius: 20, padding: 22, borderWidth: 1, borderColor: Colors.cardBorder },
  authCardTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: Colors.text, marginBottom: 6 },
  authCardDesc: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginBottom: 20 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.cardBorder },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 10, paddingTop: 4 },
  headerTitle: { flex: 1, fontSize: 17, fontFamily: "Inter_700Bold", color: Colors.text },
  savedBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: Colors.success + "18", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: Colors.success + "40" },
  savedBadgeText: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.success },
  saveBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.accent, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  saveBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
  tabBar: { flexDirection: "row", gap: 8, marginBottom: 16 },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.cardBorder },
  tabActive: { borderColor: Colors.accent + "60", backgroundColor: Colors.accent + "15" },
  tabText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.textMuted },
  tabTextActive: { color: Colors.accent },
  scroll: { paddingTop: 4 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 20, justifyContent: "center" },
  loadingText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  section: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: Colors.cardBorder, gap: 14 },
  sectionHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  sectionIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  sectionTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.text },
  sectionDesc: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 2 },
  inputGroup: { gap: 6 },
  label: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  inputRow: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.card, borderRadius: 10, borderWidth: 1, borderColor: Colors.cardBorder, paddingHorizontal: 12, height: 46 },
  inputBlock: { height: 46, backgroundColor: Colors.card, borderRadius: 10, borderWidth: 1, borderColor: Colors.cardBorder, paddingHorizontal: 12, color: Colors.text, fontSize: 13, fontFamily: "Inter_400Regular" },
  input: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.text },
  row2: { flexDirection: "row", gap: 10 },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  toggleLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.text },
  toggleDesc: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 2 },
  scheduleBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#F59E0B15", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: "#F59E0B30" },
  scheduleBadgeText: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#F59E0B" },
  bannerPreview: { width: "100%", height: 80, borderRadius: 10, marginTop: 8 },
  logoPreviewRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  logoPreview: { width: 48, height: 48, borderRadius: 12, backgroundColor: Colors.card },
  logoPreviewLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  colorPresetRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  colorSwatch: { width: 36, height: 36, borderRadius: 10, borderWidth: 2, borderColor: "transparent" },
  colorSwatchActive: { borderColor: "#fff" },
  colorDot: { width: 22, height: 22, borderRadius: 6, marginRight: 8, flexShrink: 0 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.card, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: Colors.cardBorder },
  statChipText: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  pushResult: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.card, borderRadius: 8, padding: 10 },
  pushResultText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  saveFullBtn: { borderRadius: 14, overflow: "hidden", marginTop: 4 },
  saveFullBtnGradient: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, height: 52, borderRadius: 14 },
  saveFullBtnText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" },
  signOutBtn: { alignItems: "center", paddingVertical: 16 },
  signOutText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textMuted, textDecorationLine: "underline" },
  signInBtn: { borderRadius: 12, overflow: "hidden", marginTop: 4 },
  signInBtnGradient: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, height: 52, borderRadius: 12 },
  signInBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
  analyticsGrid: { flexDirection: "row", gap: 12, marginBottom: 14 },
  analyticCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: 14, padding: 16, alignItems: "center", gap: 6, borderWidth: 1 },
  analyticValue: { fontSize: 28, fontFamily: "Inter_700Bold" },
  analyticLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.textSecondary, textAlign: "center" },
  analyticsRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  analyticsRowLabel: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.text },
  analyticsRowValue: { fontSize: 13, fontFamily: "Inter_700Bold", color: Colors.text },
  analyticsRowMeta: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  emptyAnalytics: { alignItems: "center", paddingVertical: 32, gap: 10 },
  emptyAnalyticsText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textMuted, textAlign: "center", maxWidth: 280, lineHeight: 20 },
});
