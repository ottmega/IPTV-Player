import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useIPTV, LoginType } from "@/context/IPTVContext";
import Colors from "@/constants/colors";
import * as Haptics from "expo-haptics";

const { width } = Dimensions.get("window");

type Tab = "xtream" | "m3u" | "stalker";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "xtream", label: "Xtream Codes", icon: "server" },
  { key: "m3u", label: "M3U Playlist", icon: "playlist-play" },
  { key: "stalker", label: "Stalker Portal", icon: "set-top-box" },
];

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login } = useIPTV();
  const [activeTab, setActiveTab] = useState<Tab>("xtream");
  const [loading, setLoading] = useState(false);

  const [xtreamServer, setXtreamServer] = useState("");
  const [xtreamUser, setXtreamUser] = useState("");
  const [xtreamPass, setXtreamPass] = useState("");
  const [showPass, setShowPass] = useState(false);

  const [m3uUrl, setM3uUrl] = useState("");

  const [stalkerUrl, setStalkerUrl] = useState("");
  const [stalkerMac, setStalkerMac] = useState("");

  const handleLogin = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setLoading(true);

      if (activeTab === "xtream") {
        if (!xtreamServer || !xtreamUser || !xtreamPass) {
          Alert.alert("Missing Fields", "Please fill in all fields.");
          return;
        }
        const serverUrl = xtreamServer.startsWith("http") ? xtreamServer.replace(/\/$/, "") : `http://${xtreamServer}`;
        await login("xtream", { serverUrl, username: xtreamUser, password: xtreamPass });
      } else if (activeTab === "m3u") {
        if (!m3uUrl) {
          Alert.alert("Missing Field", "Please enter the M3U playlist URL.");
          return;
        }
        await login("m3u", { playlistUrl: m3uUrl });
      } else {
        if (!stalkerUrl || !stalkerMac) {
          Alert.alert("Missing Fields", "Please fill in all fields.");
          return;
        }
        const portalUrl = stalkerUrl.startsWith("http") ? stalkerUrl.replace(/\/$/, "") : `http://${stalkerUrl}`;
        await login("stalker", { portalUrl, macAddress: stalkerMac });
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const msg = e instanceof Error ? e.message : "Login failed. Please check your credentials.";
      Alert.alert("Connection Error", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={["#0A0A12", "#0F0F20", "#0A0A12"]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <LinearGradient
            colors={[Colors.gradient1, Colors.gradient2]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logoGradient}
          >
            <Ionicons name="play" size={32} color="#fff" />
          </LinearGradient>
          <Text style={styles.appName}>OTTMEGA</Text>
          <Text style={styles.appSub}>IPTV Player</Text>
        </View>

        <View style={styles.disclaimer}>
          <Feather name="shield" size={14} color={Colors.textMuted} />
          <Text style={styles.disclaimerText}>
            This app does not provide any TV channels or content. Users must provide their own playlists.
          </Text>
        </View>

        <View style={styles.tabsRow}>
          {TABS.map((tab) => (
            <Pressable
              key={tab.key}
              style={[styles.tabBtn, activeTab === tab.key && styles.tabBtnActive]}
              onPress={() => {
                setActiveTab(tab.key);
                Haptics.selectionAsync();
              }}
            >
              <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.form}>
          {activeTab === "xtream" && (
            <>
              <InputField
                label="Server URL"
                placeholder="http://your-server.com:8080"
                value={xtreamServer}
                onChangeText={setXtreamServer}
                icon="globe-outline"
                keyboardType="url"
                autoCapitalize="none"
              />
              <InputField
                label="Username"
                placeholder="Enter username"
                value={xtreamUser}
                onChangeText={setXtreamUser}
                icon="person-outline"
                autoCapitalize="none"
              />
              <InputField
                label="Password"
                placeholder="Enter password"
                value={xtreamPass}
                onChangeText={setXtreamPass}
                icon="lock-closed-outline"
                secureTextEntry={!showPass}
                rightIcon={showPass ? "eye-off-outline" : "eye-outline"}
                onRightIconPress={() => setShowPass((p) => !p)}
              />
            </>
          )}

          {activeTab === "m3u" && (
            <InputField
              label="Playlist URL"
              placeholder="http://example.com/playlist.m3u"
              value={m3uUrl}
              onChangeText={setM3uUrl}
              icon="link-outline"
              keyboardType="url"
              autoCapitalize="none"
            />
          )}

          {activeTab === "stalker" && (
            <>
              <InputField
                label="Portal URL"
                placeholder="http://portal.example.com/stalker_portal/c/"
                value={stalkerUrl}
                onChangeText={setStalkerUrl}
                icon="globe-outline"
                keyboardType="url"
                autoCapitalize="none"
              />
              <InputField
                label="MAC Address"
                placeholder="00:1A:79:XX:XX:XX"
                value={stalkerMac}
                onChangeText={setStalkerMac}
                icon="hardware-chip-outline"
                autoCapitalize="characters"
              />
            </>
          )}

          <Pressable
            style={({ pressed }) => [styles.loginBtn, pressed && styles.loginBtnPressed]}
            onPress={handleLogin}
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

        <View style={{ height: insets.bottom + 20 }} />
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
        <Ionicons name={icon} size={18} color={Colors.textMuted} style={styles.inputIcon} />
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
            <Ionicons name={rightIcon} size={18} color={Colors.textMuted} />
          </Pressable>
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
  scroll: {
    paddingHorizontal: 24,
  },
  header: {
    alignItems: "center",
    paddingTop: 40,
    paddingBottom: 24,
  },
  logoGradient: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  appName: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    letterSpacing: 4,
  },
  appSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    letterSpacing: 2,
    marginTop: 4,
  },
  disclaimer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 24,
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
  tabsRow: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
    gap: 2,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: "center",
  },
  tabBtnActive: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  tabLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
    textAlign: "center",
  },
  tabLabelActive: {
    color: Colors.accent,
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
  },
  inputRightBtn: {
    padding: 6,
  },
  loginBtn: {
    marginTop: 8,
    borderRadius: 14,
    overflow: "hidden",
  },
  loginBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  loginBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 56,
    borderRadius: 14,
  },
  loginBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 32,
    gap: 8,
  },
  footerLink: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    textDecorationLine: "underline",
  },
  footerDot: {
    color: Colors.textMuted,
    fontSize: 12,
  },
});
