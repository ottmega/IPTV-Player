import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Platform,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import {
  useIPTV,
  LoginType,
  XtreamCredentials,
  M3UCredentials,
  StalkerCredentials,
} from "@/context/IPTVContext";
import Colors from "@/constants/colors";
import * as Haptics from "expo-haptics";

type Tab = "xtream" | "m3u" | "stalker";

const TABS: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "xtream", label: "Xtream Codes", icon: "server-outline" },
  { key: "m3u", label: "M3U Playlist", icon: "list-outline" },
  { key: "stalker", label: "Stalker Portal", icon: "desktop-outline" },
];

const FEATURES: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
  { icon: "tv-outline", text: "Live TV" },
  { icon: "film-outline", text: "Movies" },
  { icon: "play-circle-outline", text: "Series" },
  { icon: "time-outline", text: "Catch-Up" },
  { icon: "grid-outline", text: "Multi-Screen" },
];

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { setPendingLogin, savedAccount } = useIPTV();
  const [activeTab, setActiveTab] = useState<Tab>("xtream");
  const [loading, setLoading] = useState(false);

  const [xtreamServer, setXtreamServer] = useState("");
  const [xtreamUser, setXtreamUser] = useState("");
  const [xtreamPass, setXtreamPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [m3uUrl, setM3uUrl] = useState("");
  const [stalkerUrl, setStalkerUrl] = useState("");
  const [stalkerMac, setStalkerMac] = useState("");

  const isPortrait = height > width;

  useEffect(() => {
    if (Platform.OS !== "web") {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (savedAccount) {
      setActiveTab(savedAccount.loginType);
      if (savedAccount.loginType === "xtream") {
        const c = savedAccount.credentials as XtreamCredentials;
        setXtreamServer(c.serverUrl || "");
        setXtreamUser(c.username || "");
        setXtreamPass(c.password || "");
      } else if (savedAccount.loginType === "m3u") {
        const c = savedAccount.credentials as M3UCredentials;
        setM3uUrl(c.playlistUrl || "");
      } else if (savedAccount.loginType === "stalker") {
        const c = savedAccount.credentials as StalkerCredentials;
        setStalkerUrl(c.portalUrl || "");
        setStalkerMac(c.macAddress || "");
      }
    }
  }, [savedAccount]);

  const handleConnect = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    let type: LoginType = activeTab;
    let creds: XtreamCredentials | M3UCredentials | StalkerCredentials;

    if (activeTab === "xtream") {
      if (!xtreamServer || !xtreamUser || !xtreamPass) {
        Alert.alert("Missing Fields", "Please fill in all fields.");
        return;
      }
      const serverUrl = xtreamServer.startsWith("http")
        ? xtreamServer.replace(/\/$/, "")
        : `http://${xtreamServer}`;
      creds = { serverUrl, username: xtreamUser, password: xtreamPass };
    } else if (activeTab === "m3u") {
      if (!m3uUrl) {
        Alert.alert("Missing Field", "Please enter the M3U playlist URL.");
        return;
      }
      creds = { playlistUrl: m3uUrl };
    } else {
      if (!stalkerUrl || !stalkerMac) {
        Alert.alert("Missing Fields", "Please fill in all fields.");
        return;
      }
      const portalUrl = stalkerUrl.startsWith("http")
        ? stalkerUrl.replace(/\/$/, "")
        : `http://${stalkerUrl}`;
      creds = { portalUrl, macAddress: stalkerMac };
    }

    setPendingLogin({ type, credentials: creds });
    router.replace("/loading");
  };

  const topPad = Platform.OS === "web" ? 24 : insets.top + 8;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 16;

  if (isPortrait) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#06060F", "#0D0D20", "#06060F"]} style={StyleSheet.absoluteFill} />
        <View style={styles.decorCircle1} />
        <View style={styles.decorCircle2} />

        <ScrollView
          contentContainerStyle={[
            styles.portraitScroll,
            { paddingTop: topPad, paddingBottom: bottomPad },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.portraitLogo}>
            <LinearGradient
              colors={[Colors.gradient1, Colors.gradient2]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.portraitLogoBox}
            >
              <Ionicons name="play" size={28} color="#fff" />
            </LinearGradient>
            <View>
              <Text style={styles.portraitAppName}>OTTMEGA</Text>
              <Text style={styles.portraitAppSub}>IPTV Player</Text>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.featureBadgesRow}
          >
            {FEATURES.map((f) => (
              <View key={f.text} style={styles.featureBadge}>
                <Ionicons name={f.icon} size={13} color={Colors.accent} />
                <Text style={styles.featureBadgeText}>{f.text}</Text>
              </View>
            ))}
          </ScrollView>

          <View style={[styles.portraitCard, { maxWidth: 420, width: "100%", alignSelf: "center" }]}>
            <Text style={styles.cardTitle}>Connect Your Account</Text>

            {savedAccount && (
              <View style={styles.savedBadge}>
                <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                <Text style={styles.savedText}>Saved account loaded</Text>
              </View>
            )}

            <View style={styles.tabsRow}>
              {TABS.map((tab) => (
                <Pressable
                  key={tab.key}
                  style={[styles.tabBtn, activeTab === tab.key && styles.tabBtnActive]}
                  onPress={() => { setActiveTab(tab.key); Haptics.selectionAsync(); }}
                >
                  <Ionicons
                    name={tab.icon}
                    size={13}
                    color={activeTab === tab.key ? Colors.accent : Colors.textMuted}
                  />
                  <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
                    {tab.key === "xtream" ? "Xtream" : tab.key === "m3u" ? "M3U" : "Stalker"}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.form}>
              {activeTab === "xtream" && (
                <>
                  <InputField label="Server URL" placeholder="http://server.example.com:8080" value={xtreamServer} onChangeText={setXtreamServer} icon="globe-outline" keyboardType="url" />
                  <InputField label="Username" placeholder="Enter username" value={xtreamUser} onChangeText={setXtreamUser} icon="person-outline" />
                  <InputField label="Password" placeholder="Enter password" value={xtreamPass} onChangeText={setXtreamPass} icon="lock-closed-outline" secureTextEntry={!showPass} rightIcon={showPass ? "eye-off-outline" : "eye-outline"} onRightIconPress={() => setShowPass((p) => !p)} />
                </>
              )}
              {activeTab === "m3u" && (
                <InputField label="Playlist URL" placeholder="http://example.com/playlist.m3u" value={m3uUrl} onChangeText={setM3uUrl} icon="link-outline" keyboardType="url" />
              )}
              {activeTab === "stalker" && (
                <>
                  <InputField label="Portal URL" placeholder="http://portal.example.com/c/" value={stalkerUrl} onChangeText={setStalkerUrl} icon="globe-outline" keyboardType="url" />
                  <InputField label="MAC Address" placeholder="00:1A:79:XX:XX:XX" value={stalkerMac} onChangeText={setStalkerMac} icon="hardware-chip-outline" autoCapitalize="characters" />
                </>
              )}

              <Pressable
                style={({ pressed }) => [styles.loginBtn, pressed && styles.loginBtnPressed]}
                onPress={handleConnect}
                disabled={loading}
              >
                <LinearGradient
                  colors={[Colors.gradient1, Colors.gradient2]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.loginBtnGradient}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="play-circle" size={20} color="#fff" />
                      <Text style={styles.loginBtnText}>Connect</Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>
            </View>

            <View style={styles.footer}>
              <Pressable onPress={() => router.push("/privacy")}>
                <Text style={styles.footerLink}>Privacy Policy</Text>
              </Pressable>
              <Text style={styles.footerDot}>·</Text>
              <Pressable onPress={() => router.push("/terms")}>
                <Text style={styles.footerLink}>Terms of Service</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.portraitDisclaimer}>
            <Ionicons name="shield-checkmark-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.portraitDisclaimerText}>
              This app does not provide any TV channels. Connect your own playlist.
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  const leftPad = Platform.OS === "web" ? 40 : insets.left + 20;
  const rightPad = Platform.OS === "web" ? 40 : insets.right + 20;

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#06060F", "#0D0D20", "#06060F"]} style={StyleSheet.absoluteFill} />
      <View style={styles.decorCircle1} />
      <View style={styles.decorCircle2} />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPad, paddingLeft: leftPad, paddingRight: rightPad, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.layout}>
          <View style={styles.leftPanel}>
            <LinearGradient
              colors={[Colors.gradient1, Colors.gradient2]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoBox}
            >
              <Ionicons name="play" size={36} color="#fff" />
            </LinearGradient>
            <Text style={styles.appName}>OTTMEGA</Text>
            <Text style={styles.appSub}>IPTV Player</Text>

            <View style={styles.featureList}>
              {FEATURES.map((f) => (
                <View key={f.text} style={styles.featureItem}>
                  <View style={styles.featureIcon}>
                    <Ionicons name={f.icon} size={14} color={Colors.accent} />
                  </View>
                  <Text style={styles.featureText}>{f.text}</Text>
                </View>
              ))}
            </View>

            <View style={styles.disclaimer}>
              <Ionicons name="shield-checkmark-outline" size={13} color={Colors.textMuted} />
              <Text style={styles.disclaimerText}>
                This app does not provide any TV channels. Connect your own playlist.
              </Text>
            </View>
          </View>

          <View style={styles.rightPanel}>
            <View style={styles.glassCard}>
              <Text style={styles.cardTitle}>Connect Your Account</Text>
              {savedAccount && (
                <View style={styles.savedBadge}>
                  <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                  <Text style={styles.savedText}>Saved account loaded</Text>
                </View>
              )}

              <View style={styles.tabsRow}>
                {TABS.map((tab) => (
                  <Pressable
                    key={tab.key}
                    style={[styles.tabBtn, activeTab === tab.key && styles.tabBtnActive]}
                    onPress={() => { setActiveTab(tab.key); Haptics.selectionAsync(); }}
                  >
                    <Ionicons name={tab.icon} size={14} color={activeTab === tab.key ? Colors.accent : Colors.textMuted} />
                    <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>{tab.label}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.form}>
                {activeTab === "xtream" && (
                  <>
                    <InputField label="Server URL" placeholder="http://server.example.com:8080" value={xtreamServer} onChangeText={setXtreamServer} icon="globe-outline" keyboardType="url" />
                    <InputField label="Username" placeholder="Enter username" value={xtreamUser} onChangeText={setXtreamUser} icon="person-outline" />
                    <InputField label="Password" placeholder="Enter password" value={xtreamPass} onChangeText={setXtreamPass} icon="lock-closed-outline" secureTextEntry={!showPass} rightIcon={showPass ? "eye-off-outline" : "eye-outline"} onRightIconPress={() => setShowPass((p) => !p)} />
                  </>
                )}
                {activeTab === "m3u" && (
                  <InputField label="Playlist URL" placeholder="http://example.com/playlist.m3u" value={m3uUrl} onChangeText={setM3uUrl} icon="link-outline" keyboardType="url" />
                )}
                {activeTab === "stalker" && (
                  <>
                    <InputField label="Portal URL" placeholder="http://portal.example.com/c/" value={stalkerUrl} onChangeText={setStalkerUrl} icon="globe-outline" keyboardType="url" />
                    <InputField label="MAC Address" placeholder="00:1A:79:XX:XX:XX" value={stalkerMac} onChangeText={setStalkerMac} icon="hardware-chip-outline" autoCapitalize="characters" />
                  </>
                )}

                <Pressable
                  style={({ pressed }) => [styles.loginBtn, pressed && styles.loginBtnPressed]}
                  onPress={handleConnect}
                  disabled={loading}
                >
                  <LinearGradient
                    colors={[Colors.gradient1, Colors.gradient2]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.loginBtnGradient}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="play-circle" size={20} color="#fff" />
                        <Text style={styles.loginBtnText}>Connect</Text>
                      </>
                    )}
                  </LinearGradient>
                </Pressable>
              </View>

              <View style={styles.footer}>
                <Pressable onPress={() => router.push("/privacy")}>
                  <Text style={styles.footerLink}>Privacy Policy</Text>
                </Pressable>
                <Text style={styles.footerDot}>·</Text>
                <Pressable onPress={() => router.push("/terms")}>
                  <Text style={styles.footerLink}>Terms of Service</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

interface InputFieldProps {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  icon: keyof typeof Ionicons.glyphMap;
  secureTextEntry?: boolean;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  keyboardType?: "default" | "url" | "email-address";
  autoCapitalize?: "none" | "characters" | "words" | "sentences";
}

function InputField({ label, placeholder, value, onChangeText, icon, secureTextEntry, rightIcon, onRightIconPress, keyboardType = "default", autoCapitalize = "none" }: InputFieldProps) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.inputRow}>
        <Ionicons name={icon} size={16} color={Colors.textMuted} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
        />
        {rightIcon && (
          <Pressable onPress={onRightIconPress} style={styles.inputRightBtn}>
            <Ionicons name={rightIcon} size={16} color={Colors.textMuted} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#06060F" },
  decorCircle1: { position: "absolute", width: 300, height: 300, borderRadius: 150, backgroundColor: Colors.gradient1 + "18", top: -80, left: -60 },
  decorCircle2: { position: "absolute", width: 250, height: 250, borderRadius: 125, backgroundColor: Colors.gradient2 + "14", bottom: -60, right: -40 },

  portraitScroll: { flexGrow: 1, paddingHorizontal: 20, gap: 16 },
  portraitLogo: { flexDirection: "row", alignItems: "center", gap: 14, paddingTop: 8 },
  portraitLogoBox: { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  portraitAppName: { fontSize: 26, fontFamily: "Inter_700Bold", color: Colors.text, letterSpacing: 4 },
  portraitAppSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textSecondary, letterSpacing: 3 },
  featureBadgesRow: { gap: 8, paddingVertical: 4 },
  featureBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: Colors.accentSoft, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: Colors.accent + "30" },
  featureBadgeText: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.accent },
  portraitCard: { backgroundColor: Colors.surface + "CC", borderRadius: 20, padding: 22, borderWidth: 1, borderColor: Colors.cardBorder },
  portraitDisclaimer: { flexDirection: "row", alignItems: "flex-start", gap: 7, paddingHorizontal: 4 },
  portraitDisclaimerText: { flex: 1, fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textMuted, lineHeight: 15 },

  scroll: { flexGrow: 1, justifyContent: "center" },
  layout: { flexDirection: "row", gap: 32, alignItems: "center" },
  leftPanel: { flex: 1, gap: 16, alignItems: "flex-start", justifyContent: "center", paddingRight: 16 },
  logoBox: { width: 80, height: 80, borderRadius: 22, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  appName: { fontSize: 32, fontFamily: "Inter_700Bold", color: Colors.text, letterSpacing: 5 },
  appSub: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary, letterSpacing: 3, marginTop: -8 },
  featureList: { gap: 10, marginTop: 8 },
  featureItem: { flexDirection: "row", alignItems: "center", gap: 10 },
  featureIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: Colors.accentSoft, alignItems: "center", justifyContent: "center" },
  featureText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  disclaimer: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 8, maxWidth: 260 },
  disclaimerText: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted, lineHeight: 16 },
  rightPanel: { flex: 1, maxWidth: 420 },
  glassCard: { backgroundColor: Colors.surface + "CC", borderRadius: 20, padding: 28, borderWidth: 1, borderColor: Colors.cardBorder },
  cardTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text, marginBottom: 16 },
  savedBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.success + "18", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 16, alignSelf: "flex-start", borderWidth: 1, borderColor: Colors.success + "40" },
  savedText: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.success },
  tabsRow: { flexDirection: "row", backgroundColor: Colors.card, borderRadius: 12, padding: 4, marginBottom: 20, gap: 2 },
  tabBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 9, borderRadius: 9, gap: 5 },
  tabBtnActive: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.cardBorder },
  tabLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.textMuted },
  tabLabelActive: { color: Colors.accent },
  form: { gap: 14 },
  inputGroup: { gap: 6 },
  inputLabel: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  inputRow: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.card, borderRadius: 10, borderWidth: 1, borderColor: Colors.cardBorder, paddingHorizontal: 12, height: 46 },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.text },
  inputRightBtn: { padding: 6 },
  loginBtn: { marginTop: 6, borderRadius: 12, overflow: "hidden" },
  loginBtnPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  loginBtnGradient: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, height: 52, borderRadius: 12 },
  loginBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
  footer: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 20, gap: 8 },
  footerLink: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted, textDecorationLine: "underline" },
  footerDot: { color: Colors.textMuted, fontSize: 11 },
});
