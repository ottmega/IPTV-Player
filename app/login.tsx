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
  { key: "xtream", label: "Xtream", icon: "server-outline" },
  { key: "m3u", label: "M3U", icon: "list-outline" },
  { key: "stalker", label: "Stalker", icon: "desktop-outline" },
];

const FEATURES: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
  { icon: "tv-outline", text: "Live TV" },
  { icon: "film-outline", text: "Movies" },
  { icon: "play-circle-outline", text: "Series" },
  { icon: "time-outline", text: "Catch-Up" },
  { icon: "grid-outline", text: "Multi-Screen" },
  { icon: "speedometer-outline", text: "Speed Test" },
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
      let serverUrl: string;
      try {
        const raw = xtreamServer.trim();
        const withProto = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
        const parsed = new URL(withProto);
        serverUrl = `${parsed.protocol}//${parsed.host}`;
      } catch {
        Alert.alert("Invalid URL", "Please enter a valid server URL (e.g. http://server.com:8080)");
        return;
      }
      creds = { serverUrl, username: xtreamUser.trim(), password: xtreamPass.trim() };
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

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 8;

  if (isPortrait) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={["#05051A", "#0A0520", "#06061A"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.4, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <ScrollView
          contentContainerStyle={[
            styles.portraitScroll,
            { paddingTop: topPad + 32, paddingBottom: bottomPad + 16 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoSection}>
            <LinearGradient
              colors={[Colors.gradient1, Colors.gradient2]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoIconBox}
            >
              <Ionicons name="play" size={30} color="#fff" />
            </LinearGradient>
            <Text style={styles.logoTitle}>OTTMEGA</Text>
            <Text style={styles.logoSub}>IPTV Player</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.featureRow}
          >
            {FEATURES.map((f) => (
              <View key={f.text} style={styles.featureCard}>
                <View style={styles.featureCardIcon}>
                  <Ionicons name={f.icon} size={22} color={Colors.accent} />
                </View>
                <Text style={styles.featureCardLabel}>{f.text}</Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Connect Your Account</Text>

            {savedAccount && (
              <View style={styles.savedBadge}>
                <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                <Text style={styles.savedText}>Saved account loaded</Text>
              </View>
            )}

            <View style={styles.tabsContainer}>
              {TABS.map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                  <Pressable
                    key={tab.key}
                    style={[styles.tabPill, isActive && styles.tabPillActive]}
                    onPress={() => { setActiveTab(tab.key); Haptics.selectionAsync(); }}
                  >
                    {isActive ? (
                      <LinearGradient
                        colors={[Colors.gradient1, Colors.gradient2]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.tabPillGradient}
                      >
                        <Ionicons name={tab.icon} size={13} color="#fff" />
                        <Text style={[styles.tabPillLabel, styles.tabPillLabelActive]}>{tab.label}</Text>
                      </LinearGradient>
                    ) : (
                      <View style={styles.tabPillInner}>
                        <Ionicons name={tab.icon} size={13} color={Colors.textMuted} />
                        <Text style={styles.tabPillLabel}>{tab.label}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.formFields}>
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
            </View>

            <Pressable
              style={({ pressed }) => [styles.connectBtn, pressed && styles.connectBtnPressed]}
              onPress={handleConnect}
              disabled={loading}
            >
              <LinearGradient
                colors={[Colors.gradient1, Colors.gradient2]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.connectBtnGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="play-circle" size={20} color="#fff" />
                    <Text style={styles.connectBtnText}>Connect</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>

            <View style={styles.cardFooter}>
              <Pressable onPress={() => router.push("/privacy")}>
                <Text style={styles.footerLink}>Privacy Policy</Text>
              </Pressable>
              <Text style={styles.footerDot}>·</Text>
              <Pressable onPress={() => router.push("/terms")}>
                <Text style={styles.footerLink}>Terms of Service</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.disclaimer}>
            <Ionicons name="shield-checkmark-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.disclaimerText}>
              This app does not provide any TV channels or content. You must supply your own playlist.
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
      <LinearGradient
        colors={["#05051A", "#0A0520", "#06061A"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.4, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={[
          styles.landscapeScroll,
          { paddingTop: topPad, paddingLeft: leftPad, paddingRight: rightPad, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.landscapeLayout}>
          <View style={styles.leftPanel}>
            <LinearGradient
              colors={[Colors.gradient1, Colors.gradient2]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.landscapeLogoBox}
            >
              <Ionicons name="play" size={36} color="#fff" />
            </LinearGradient>
            <Text style={styles.landscapeAppName}>OTTMEGA</Text>
            <Text style={styles.landscapeAppSub}>IPTV Player</Text>

            <View style={styles.landscapeFeatureList}>
              {FEATURES.map((f) => (
                <View key={f.text} style={styles.landscapeFeatureItem}>
                  <View style={styles.landscapeFeatureIcon}>
                    <Ionicons name={f.icon} size={14} color={Colors.accent} />
                  </View>
                  <Text style={styles.landscapeFeatureText}>{f.text}</Text>
                </View>
              ))}
            </View>

            <View style={styles.landscapeDisclaimer}>
              <Ionicons name="shield-checkmark-outline" size={12} color={Colors.textMuted} />
              <Text style={styles.landscapeDisclaimerText}>
                This app does not provide any TV channels. Connect your own playlist.
              </Text>
            </View>
          </View>

          <View style={styles.rightPanel}>
            <View style={styles.landscapeCard}>
              <Text style={styles.cardTitle}>Connect Your Account</Text>
              {savedAccount && (
                <View style={styles.savedBadge}>
                  <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                  <Text style={styles.savedText}>Saved account loaded</Text>
                </View>
              )}

              <View style={styles.tabsContainer}>
                {TABS.map((tab) => {
                  const isActive = activeTab === tab.key;
                  return (
                    <Pressable
                      key={tab.key}
                      style={[styles.tabPill, isActive && styles.tabPillActive]}
                      onPress={() => { setActiveTab(tab.key); Haptics.selectionAsync(); }}
                    >
                      {isActive ? (
                        <LinearGradient
                          colors={[Colors.gradient1, Colors.gradient2]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.tabPillGradient}
                        >
                          <Ionicons name={tab.icon} size={13} color="#fff" />
                          <Text style={[styles.tabPillLabel, styles.tabPillLabelActive]}>{tab.label}</Text>
                        </LinearGradient>
                      ) : (
                        <View style={styles.tabPillInner}>
                          <Ionicons name={tab.icon} size={13} color={Colors.textMuted} />
                          <Text style={styles.tabPillLabel}>{tab.label}</Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.formFields}>
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
              </View>

              <Pressable
                style={({ pressed }) => [styles.connectBtn, pressed && styles.connectBtnPressed]}
                onPress={handleConnect}
                disabled={loading}
              >
                <LinearGradient
                  colors={[Colors.gradient1, Colors.gradient2]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.connectBtnGradient}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="play-circle" size={20} color="#fff" />
                      <Text style={styles.connectBtnText}>Connect</Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>

              <View style={styles.cardFooter}>
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

function InputField({
  label,
  placeholder,
  value,
  onChangeText,
  icon,
  secureTextEntry,
  rightIcon,
  onRightIconPress,
  keyboardType = "default",
  autoCapitalize = "none",
}: InputFieldProps) {
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
  container: {
    flex: 1,
    backgroundColor: "#05051A",
  },

  portraitScroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    gap: 24,
    alignItems: "center",
  },

  logoSection: {
    alignItems: "center",
    gap: 8,
    width: "100%",
    marginBottom: 0,
  },
  logoIconBox: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  logoTitle: {
    fontSize: 30,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    letterSpacing: 6,
  },
  logoSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    letterSpacing: 4,
    textTransform: "uppercase",
  },

  featureRow: {
    gap: 12,
    paddingVertical: 4,
  },
  featureCard: {
    width: 100,
    height: 70,
    borderRadius: 16,
    backgroundColor: "rgba(20,20,40,0.85)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  featureCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  featureCardLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    textAlign: "center",
  },

  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "rgba(20,20,35,0.85)",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    gap: 0,
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginBottom: 14,
  },
  savedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.success + "18",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 14,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: Colors.success + "40",
  },
  savedText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.success,
  },

  tabsContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(10,10,25,0.7)",
    borderRadius: 12,
    padding: 3,
    marginBottom: 18,
    gap: 2,
    height: 44,
  },
  tabPill: {
    flex: 1,
    borderRadius: 10,
    overflow: "hidden",
  },
  tabPillActive: {
    borderRadius: 10,
    overflow: "hidden",
  },
  tabPillGradient: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  tabPillInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 6,
  },
  tabPillLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
  },
  tabPillLabelActive: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
  },

  formFields: {
    gap: 14,
    marginBottom: 18,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(10,10,28,0.8)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
  },
  inputRightBtn: {
    padding: 6,
  },

  connectBtn: {
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 18,
  },
  connectBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  connectBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 54,
    borderRadius: 14,
  },
  connectBtnText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },

  cardFooter: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  footerLink: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    textDecorationLine: "underline",
  },
  footerDot: {
    color: Colors.textMuted,
    fontSize: 11,
  },

  disclaimer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    maxWidth: 360,
    paddingHorizontal: 4,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    lineHeight: 15,
    textAlign: "center",
  },

  landscapeScroll: {
    flexGrow: 1,
    justifyContent: "center",
  },
  landscapeLayout: {
    flexDirection: "row",
    gap: 32,
    alignItems: "center",
  },
  leftPanel: {
    flex: 1,
    gap: 16,
    alignItems: "flex-start",
    justifyContent: "center",
    paddingRight: 16,
  },
  landscapeLogoBox: {
    width: 80,
    height: 80,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  landscapeAppName: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    letterSpacing: 5,
  },
  landscapeAppSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    letterSpacing: 3,
    marginTop: -8,
    textTransform: "uppercase",
  },
  landscapeFeatureList: {
    gap: 10,
    marginTop: 8,
  },
  landscapeFeatureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  landscapeFeatureIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  landscapeFeatureText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  landscapeDisclaimer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 8,
    maxWidth: 260,
  },
  landscapeDisclaimerText: {
    flex: 1,
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    lineHeight: 16,
  },
  rightPanel: {
    flex: 1,
    maxWidth: 420,
  },
  landscapeCard: {
    backgroundColor: "rgba(20,20,35,0.85)",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
});
