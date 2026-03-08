import React, { useState, useEffect, useCallback } from "react";
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

  const [config, setConfig] = useState<AppConfig>({
    logo: "",
    banner: "",
    bannerTitle: "Visit OTTMEGA Website",
    bannerLink: "https://ottmega.in",
    showBanner: false,
    announcement: "",
    themeColor: "#4F8EF7",
  });

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const sidePad = Platform.OS === "web" ? 24 : 16;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const verify = async () => {
    if (!adminKey.trim()) return;
    setAuthLoading(true);
    try {
      const base = getApiUrl();
      const url = new URL(`/api/admin/verify?key=${encodeURIComponent(adminKey.trim())}`, base).toString();
      const res = await fetch(url, { credentials: "include" });
      const data = await res.json();
      if (data.valid) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setAuthed(true);
        loadConfig();
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert("Access Denied", "Invalid admin key. Please try again.");
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
      const base = getApiUrl();
      const url = new URL("/api/app-config", base).toString();
      const res = await fetch(url, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setConfig((prev) => ({ ...prev, ...data }));
      }
    } catch {}
    setLoadingConfig(false);
  }, []);

  const saveConfig = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const base = getApiUrl();
      const url = new URL("/api/app-config", base).toString();
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
        Alert.alert("Error", "Failed to save config. Check your admin key.");
      }
    } catch {
      Alert.alert("Error", "Network error. Could not save config.");
    } finally {
      setSaving(false);
    }
  };

  const update = (field: keyof AppConfig, value: string | boolean) =>
    setConfig((prev) => ({ ...prev, [field]: value }));

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
              style={({ pressed }) => [styles.signInBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
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
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Admin Dashboard</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {saved && (
            <View style={styles.savedBadge}>
              <Ionicons name="checkmark-circle" size={13} color={Colors.success} />
              <Text style={styles.savedBadgeText}>Saved</Text>
            </View>
          )}
          <Pressable
            style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }]}
            onPress={saveConfig}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#fff" size="small" /> : (
              <>
                <Ionicons name="cloud-upload-outline" size={15} color="#fff" />
                <Text style={styles.saveBtnText}>Save</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingHorizontal: sidePad, paddingBottom: bottomPad + 24 }]}
      >
        {loadingConfig && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={Colors.accent} size="small" />
            <Text style={styles.loadingText}>Loading current config...</Text>
          </View>
        )}

        <ConfigSection
          icon="megaphone-outline"
          title="Announcement Bar"
          desc="Message shown as a scrolling bar on the home screen. Leave empty to hide."
          iconBg={Colors.gradient1 + "25"}
          iconColor={Colors.gradient1}
        >
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

        <ConfigSection
          icon="image-outline"
          title="Promotional Banner"
          desc="Clickable image banner displayed on the home screen."
          iconBg={Colors.gradient2 + "25"}
          iconColor={Colors.gradient2}
        >
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>Show Banner</Text>
              <Text style={styles.toggleDesc}>Toggle banner visibility</Text>
            </View>
            <Switch
              value={config.showBanner}
              onValueChange={(v) => update("showBanner", v)}
              trackColor={{ true: Colors.accent, false: Colors.cardBorder }}
              thumbColor="#fff"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Banner Image URL</Text>
            <TextInput
              style={[styles.input, styles.inputBlock]}
              value={config.banner}
              onChangeText={(v) => update("banner", v)}
              placeholder="https://example.com/banner.jpg"
              placeholderTextColor={Colors.textMuted}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {!!config.banner && (
              <Image source={{ uri: config.banner }} style={styles.bannerPreview} resizeMode="cover" />
            )}
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Banner Title</Text>
            <TextInput
              style={[styles.input, styles.inputBlock]}
              value={config.bannerTitle}
              onChangeText={(v) => update("bannerTitle", v)}
              placeholder="Visit OTTMEGA Website"
              placeholderTextColor={Colors.textMuted}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Banner Link URL</Text>
            <TextInput
              style={[styles.input, styles.inputBlock]}
              value={config.bannerLink}
              onChangeText={(v) => update("bannerLink", v)}
              placeholder="https://ottmega.in"
              placeholderTextColor={Colors.textMuted}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </ConfigSection>

        <ConfigSection
          icon="logo-web-component"
          title="Custom Logo"
          desc="Replace the default play icon with a custom image URL."
          iconBg={Colors.success + "22"}
          iconColor={Colors.success}
        >
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Logo Image URL</Text>
            <TextInput
              style={[styles.input, styles.inputBlock]}
              value={config.logo}
              onChangeText={(v) => update("logo", v)}
              placeholder="https://example.com/logo.png"
              placeholderTextColor={Colors.textMuted}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          {!!config.logo && (
            <View style={styles.logoPreviewRow}>
              <Image source={{ uri: config.logo }} style={styles.logoPreview} resizeMode="cover" />
              <Text style={styles.logoPreviewLabel}>Logo preview (32×32 in header)</Text>
            </View>
          )}
        </ConfigSection>

        <ConfigSection
          icon="color-palette-outline"
          title="Theme Color"
          desc="Accent color for buttons, icons, and highlights throughout the app."
          iconBg="#F59E0B22"
          iconColor="#F59E0B"
        >
          <View style={styles.colorPresetRow}>
            {PRESET_COLORS.map((c) => (
              <Pressable
                key={c}
                style={[styles.colorSwatch, { backgroundColor: c }, config.themeColor === c && styles.colorSwatchActive]}
                onPress={() => { update("themeColor", c); Haptics.selectionAsync(); }}
              />
            ))}
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Hex Value</Text>
            <View style={styles.inputRow}>
              <View style={[styles.colorDot, { backgroundColor: config.themeColor }]} />
              <TextInput
                style={styles.input}
                value={config.themeColor}
                onChangeText={(v) => { if (/^#[0-9a-fA-F]{0,6}$/.test(v)) update("themeColor", v); }}
                placeholder="#4F8EF7"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={7}
              />
            </View>
          </View>
        </ConfigSection>

        <Pressable
          style={({ pressed }) => [styles.saveFullBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
          onPress={saveConfig}
          disabled={saving}
        >
          <LinearGradient colors={[Colors.gradient1, Colors.gradient2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.saveFullBtnGradient}>
            {saving ? <ActivityIndicator color="#fff" size="small" /> : (
              <>
                <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
                <Text style={styles.saveFullBtnText}>Save All Changes</Text>
              </>
            )}
          </LinearGradient>
        </Pressable>

        <Pressable style={styles.signOutBtn} onPress={() => setAuthed(false)}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function ConfigSection({
  icon, title, desc, iconBg, iconColor, children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  desc: string;
  iconBg: string;
  iconColor: string;
  children: React.ReactNode;
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
  authCard: { backgroundColor: Colors.surface + "CC", borderRadius: 20, padding: 22, borderWidth: 1, borderColor: Colors.cardBorder, gap: 0 },
  authCardTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: Colors.text, marginBottom: 6 },
  authCardDesc: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginBottom: 20 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.cardBorder },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 12, paddingTop: 4 },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: Colors.text },
  savedBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: Colors.success + "18", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: Colors.success + "40" },
  savedBadgeText: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.success },
  saveBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.accent, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  saveBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
  scroll: { paddingTop: 8 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
  loadingText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  section: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: Colors.cardBorder, gap: 14 },
  sectionHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  sectionIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  sectionTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.text },
  sectionDesc: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 2, lineHeight: 17 },
  inputGroup: { gap: 6 },
  label: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  inputRow: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.card, borderRadius: 10, borderWidth: 1, borderColor: Colors.cardBorder, paddingHorizontal: 12, height: 46 },
  inputBlock: { height: 46, backgroundColor: Colors.card, borderRadius: 10, borderWidth: 1, borderColor: Colors.cardBorder, paddingHorizontal: 12, color: Colors.text, fontSize: 13, fontFamily: "Inter_400Regular" },
  input: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.text },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  toggleLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.text },
  toggleDesc: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 2 },
  bannerPreview: { width: "100%", height: 90, borderRadius: 10, marginTop: 8, backgroundColor: Colors.card },
  logoPreviewRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  logoPreview: { width: 48, height: 48, borderRadius: 12, backgroundColor: Colors.card },
  logoPreviewLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  colorPresetRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  colorSwatch: { width: 36, height: 36, borderRadius: 10, borderWidth: 2, borderColor: "transparent" },
  colorSwatchActive: { borderColor: "#fff" },
  colorDot: { width: 22, height: 22, borderRadius: 6, marginRight: 8, flexShrink: 0 },
  saveFullBtn: { borderRadius: 14, overflow: "hidden", marginTop: 8, marginBottom: 12 },
  saveFullBtnGradient: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, height: 54, borderRadius: 14 },
  saveFullBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  signOutBtn: { alignItems: "center", paddingVertical: 12 },
  signOutText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textMuted, textDecorationLine: "underline" },
  signInBtn: { borderRadius: 12, overflow: "hidden", marginTop: 4 },
  signInBtnGradient: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, height: 52, borderRadius: 12 },
  signInBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
