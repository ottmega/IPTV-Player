import { useEffect } from "react";
import { router } from "expo-router";
import { useIPTV } from "@/context/IPTVContext";
import { View, ActivityIndicator } from "react-native";
import Colors from "@/constants/colors";

export default function IndexScreen() {
  const { loginType, loading } = useIPTV();

  useEffect(() => {
    if (loading) return;
    if (loginType) {
      router.replace("/(tabs)");
    } else {
      router.replace("/login");
    }
  }, [loginType, loading]);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={Colors.accent} size="large" />
    </View>
  );
}
