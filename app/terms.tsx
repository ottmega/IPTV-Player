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
    title: "1. Acceptance of Terms",
    content:
      "By downloading, installing, or using OTTMEGA IPTV ('the App'), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the App.",
  },
  {
    title: "2. Description of Service",
    content:
      "OTTMEGA IPTV is a media player application that allows users to play IPTV streams from playlists they provide. The App does not provide, host, or control any media content. All content is sourced entirely from user-configured third-party IPTV services.",
  },
  {
    title: "3. User Responsibilities",
    content:
      "You are solely responsible for ensuring that:\n\n• You have the legal right to access any content you stream\n• You comply with all applicable laws in your jurisdiction\n• The IPTV service you connect to is legitimate and licensed\n• You do not use the App to access copyrighted content without authorization",
  },
  {
    title: "4. Content Disclaimer",
    content:
      "OTTMEGA IPTV is a media player ONLY. We do not:\n\n• Provide, sell, or distribute IPTV services\n• Host or store any media content\n• Endorse any third-party IPTV provider\n• Control what content is accessible through user-configured playlists\n\nThe developer is not responsible for any content streamed by users.",
  },
  {
    title: "5. Prohibited Uses",
    content:
      "You may not use the App to:\n\n• Stream copyrighted content without authorization\n• Circumvent content protection measures\n• Violate any applicable laws or regulations\n• Engage in any activity that infringes upon intellectual property rights",
  },
  {
    title: "6. Intellectual Property",
    content:
      "The App and its original content, features, and functionality are owned by the developer and are protected by international copyright, trademark, and other intellectual property laws. You may not reproduce, distribute, or create derivative works without express written permission.",
  },
  {
    title: "7. Disclaimer of Warranties",
    content:
      "The App is provided 'AS IS' without warranties of any kind. We do not guarantee that the App will be error-free, uninterrupted, or compatible with all IPTV services. Stream playback depends entirely on your IPTV provider's service quality.",
  },
  {
    title: "8. Limitation of Liability",
    content:
      "In no event shall the developer be liable for any indirect, incidental, special, or consequential damages arising out of your use of the App, including damages related to any content you access.",
  },
  {
    title: "9. Changes to Terms",
    content:
      "We reserve the right to modify these Terms at any time. Continued use of the App following notification of changes constitutes acceptance of the updated Terms.",
  },
  {
    title: "10. Google Play Compliance",
    content:
      "OTTMEGA IPTV complies with Google Play Store policies. The App functions solely as a media player. It does not include preloaded channels, provide access to unauthorized content, or facilitate copyright infringement.",
  },
];

export default function TermsScreen() {
  const insets = useSafeAreaInsets();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.title}>Terms of Service</Text>
      </View>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPadding + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.intro}>
          <Ionicons name="document-text" size={32} color={Colors.accent} />
          <Text style={styles.introTitle}>Terms of Service</Text>
          <Text style={styles.introText}>
            Effective: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          </Text>
        </View>

        {sections.map((section, index) => (
          <View key={index} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionContent}>{section.content}</Text>
          </View>
        ))}

        <View style={styles.disclaimer}>
          <Ionicons name="shield-outline" size={16} color={Colors.accent} />
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
    fontSize: 15,
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
    backgroundColor: Colors.accentSoft,
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.accent + "40",
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 18,
  },
});
