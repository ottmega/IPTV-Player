import React from "react";
import { View, Text, StyleSheet, Pressable, Linking, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRemoteConfig, APP_VERSION } from "@/context/RemoteConfigContext";
import Colors from "@/constants/colors";

export default function ForceUpdateModal() {
  const { config, needsUpdate } = useRemoteConfig();

  const openStore = () => {
    if (config.updateUrl) {
      Linking.openURL(config.updateUrl).catch(() => {});
    }
  };

  return (
    <Modal visible={needsUpdate} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <LinearGradient colors={["#EF444430", "#EF444410"]} style={styles.iconWrap}>
            <Ionicons name="arrow-up-circle" size={40} color="#EF4444" />
          </LinearGradient>
          <Text style={styles.title}>Update Required</Text>
          <Text style={styles.desc}>
            A newer version of OTTMEGA IPTV is available.{"\n"}
            Please update to continue using the app.
          </Text>
          <View style={styles.versionRow}>
            <View style={styles.versionChip}>
              <Text style={styles.versionChipLabel}>Current</Text>
              <Text style={styles.versionChipValue}>v{APP_VERSION}</Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color={Colors.textMuted} />
            <View style={[styles.versionChip, { borderColor: Colors.success + "40", backgroundColor: Colors.success + "10" }]}>
              <Text style={styles.versionChipLabel}>Required</Text>
              <Text style={[styles.versionChipValue, { color: Colors.success }]}>v{config.minAppVersion}</Text>
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [styles.updateBtn, pressed && { opacity: 0.85 }]}
            onPress={openStore}
          >
            <LinearGradient colors={["#EF4444", "#DC2626"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.updateBtnGradient}>
              <Ionicons name="download-outline" size={18} color="#fff" />
              <Text style={styles.updateBtnText}>Update Now</Text>
            </LinearGradient>
          </Pressable>
          <Text style={styles.footnote}>You cannot use the app until it is updated.</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", alignItems: "center", justifyContent: "center", padding: 24 },
  card: { width: "100%", maxWidth: 360, backgroundColor: "#0D0D1A", borderRadius: 22, padding: 26, borderWidth: 1, borderColor: "#EF444430", alignItems: "center", gap: 14 },
  iconWrap: { width: 78, height: 78, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text, textAlign: "center" },
  desc: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center", lineHeight: 20 },
  versionRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  versionChip: { alignItems: "center", backgroundColor: Colors.surface, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: Colors.cardBorder },
  versionChipLabel: { fontSize: 9, fontFamily: "Inter_500Medium", color: Colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8 },
  versionChipValue: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.text, marginTop: 2 },
  updateBtn: { width: "100%", borderRadius: 14, overflow: "hidden" },
  updateBtnGradient: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, height: 54, borderRadius: 14 },
  updateBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  footnote: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted, textAlign: "center" },
});
