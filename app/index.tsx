import { useEffect } from "react";
import { router } from "expo-router";
import { useIPTV } from "@/context/IPTVContext";
import { View, ActivityIndicator, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Colors from "@/constants/colors";

export default function IndexScreen() {
  const { loginType, initialized } = useIPTV();

  useEffect(() => {
    if (!initialized) return;
    if (loginType) {
      router.replace("/(tabs)");
    } else {
      router.replace("/login");
    }
  }, [loginType, initialized]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.bg, "#0F0F20", Colors.bg]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[Colors.gradient1, Colors.gradient2]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.logo}
      >
        <Text style={styles.logoText}>O</Text>
      </LinearGradient>
      <Text style={styles.appName}>OTTMEGA</Text>
      <Text style={styles.appSub}>IPTV</Text>
      <ActivityIndicator color={Colors.accent} size="small" style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  logoText: {
    fontSize: 38,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: -1,
  },
  appName: {
    fontSize: 30,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    letterSpacing: 5,
  },
  appSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    letterSpacing: 3,
  },
  spinner: {
    marginTop: 32,
  },
});
