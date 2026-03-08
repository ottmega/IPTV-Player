import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";

const sections = [
  {
    title: "Information We Collect",
    content:
      "OTTMEGA IPTV does not collect or store any personal information on our servers. All playlist data, account credentials, and preferences are stored locally on your device using encrypted storage. We do not have access to your IPTV provider credentials or viewing history.",
  },
  {
    title: "Third-Party Services",
    content:
      "OTTMEGA IPTV connects to IPTV services that you configure. We are not affiliated with any IPTV provider. The content you access through third-party services is subject to their respective privacy policies and terms of service.",
  },
  {
    title: "Analytics",
    content:
      "OTTMEGA IPTV may collect anonymized usage analytics to improve app performance and stability. This data does not include personally identifiable information, IP addresses, or information about the content you stream.",
  },
  {
    title: "Data Storage",
    content:
      "All data stored by OTTMEGA IPTV (including your playlist configurations and watch history) is stored locally on your device. You can clear this data at any time through the Settings screen.",
  },
  {
    title: "Content Disclaimer",
    content:
      "OTTMEGA IPTV is a media player application only. We do not provide, host, or control any content. All channels, movies, and series accessible through this app are provided by third-party IPTV services that you configure. The developer is not responsible for any content accessed through user-configured playlists.",
  },
  {
    title: "Children's Privacy",
    content:
      "OTTMEGA IPTV is not intended for use by children under the age of 13. We do not knowingly collect personal information from children. If you are a parent or guardian, please configure parental controls within the Settings to restrict access to age-appropriate content.",
  },
  {
    title: "Changes to This Policy",
    content:
      "We reserve the right to update this Privacy Policy at any time. We will notify you of significant changes through in-app notifications or by requiring acknowledgment of the new policy.",
  },
  {
    title: "Contact",
    content:
      "If you have any questions about this Privacy Policy, please contact us through the app's support channel.",
  },
];

export default function PrivacyScreen() {
  const insets = useSafeAreaInsets();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.title}>Privacy Policy</Text>
      </View>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPadding + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.intro}>
          <Ionicons name="shield-checkmark" size={32} color={Colors.accent} />
          <Text style={styles.introTitle}>Your Privacy Matters</Text>
          <Text style={styles.introText}>
            Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          </Text>
        </View>

        {sections.map((section, index) => (
          <View key={index} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionContent}>{section.content}</Text>
          </View>
        ))}

        <View style={styles.disclaimer}>
          <Ionicons name="information-circle-outline" size={16} color={Colors.textMuted} />
          <Text style={styles.disclaimerText}>
            This app does not provide any TV channels or content. Users must provide their own playlists. The developer is not responsible for the content streamed by users.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  scroll: {
    paddingHorizontal: 20,
    gap: 16,
  },
  intro: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 8,
  },
  introTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  introText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  section: {
    gap: 10,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  sectionContent: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  disclaimer: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    lineHeight: 18,
  },
});
