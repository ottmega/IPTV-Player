import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
  Modal,
  Platform,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Video, ResizeMode } from "expo-av";
import { router } from "expo-router";
import { useIPTV, Channel } from "@/context/IPTVContext";
import Colors from "@/constants/colors";
import * as Haptics from "expo-haptics";

type ScreenMode = 2 | 4;

interface ScreenSlot {
  channel: Channel | null;
}

export default function MultiScreenScreen() {
  const insets = useSafeAreaInsets();
  const { channels, getStreamUrl } = useIPTV();
  const [mode, setMode] = useState<ScreenMode>(2);
  const [slots, setSlots] = useState<ScreenSlot[]>(Array(4).fill({ channel: null }));
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  const activeSlots = slots.slice(0, mode);

  const pickChannel = (slotIndex: number) => {
    setPickerSlot(slotIndex);
    Haptics.selectionAsync();
  };

  const selectChannel = (channel: Channel) => {
    if (pickerSlot === null) return;
    const newSlots = [...slots];
    newSlots[pickerSlot] = { channel };
    setSlots(newSlots);
    setPickerSlot(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const clearSlot = (index: number) => {
    const newSlots = [...slots];
    newSlots[index] = { channel: null };
    setSlots(newSlots);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const filteredChannels = channels.filter((c) =>
    !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.title}>Multi Screen</Text>
        <View style={styles.modeToggle}>
          {([2, 4] as ScreenMode[]).map((m) => (
            <Pressable
              key={m}
              style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
              onPress={() => { setMode(m); Haptics.selectionAsync(); }}
            >
              <Ionicons
                name={m === 2 ? "albums-outline" : "grid-outline"}
                size={16}
                color={mode === m ? Colors.accent : Colors.textMuted}
              />
              <Text style={[styles.modeBtnText, mode === m && styles.modeBtnTextActive]}>{m}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={[styles.grid, mode === 4 && styles.grid4]}>
        {activeSlots.map((slot, index) => (
          <View key={index} style={[styles.screenSlot, mode === 2 ? styles.slot2 : styles.slot4]}>
            {slot.channel ? (
              <View style={styles.slotFilled}>
                <Video
                  source={{ uri: slot.channel.url || getStreamUrl("live", slot.channel.streamId) }}
                  style={styles.slotVideo}
                  resizeMode={ResizeMode.COVER}
                  shouldPlay
                  useNativeControls={false}
                  isMuted
                />
                <View style={styles.slotOverlay}>
                  <View style={styles.slotInfo}>
                    {slot.channel.streamIcon ? (
                      <Image source={{ uri: slot.channel.streamIcon }} style={styles.slotLogo} resizeMode="contain" />
                    ) : null}
                    <Text style={styles.slotName} numberOfLines={1}>{slot.channel.name}</Text>
                  </View>
                  <Pressable style={styles.slotCloseBtn} onPress={() => clearSlot(index)}>
                    <Ionicons name="close" size={14} color="#fff" />
                  </Pressable>
                </View>
                <Pressable style={styles.slotExpandBtn} onPress={() => {
                  const url = slot.channel!.url || getStreamUrl("live", slot.channel!.streamId);
                  router.push({ pathname: "/player", params: { url, title: slot.channel!.name, type: "live" } });
                }}>
                  <Ionicons name="expand" size={14} color="rgba(255,255,255,0.7)" />
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.slotEmpty} onPress={() => pickChannel(index)}>
                <Ionicons name="add-circle-outline" size={32} color={Colors.textMuted} />
                <Text style={styles.slotEmptyText}>Add Channel</Text>
                <Text style={styles.slotNum}>Screen {index + 1}</Text>
              </Pressable>
            )}
          </View>
        ))}
      </View>

      <View style={{ flex: 1, paddingBottom: bottomPadding + 20 }} />

      <Modal visible={pickerSlot !== null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Channel</Text>
              <Pressable onPress={() => setPickerSlot(null)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </Pressable>
            </View>
            {channels.length === 0 ? (
              <View style={styles.emptyPicker}>
                <Text style={styles.emptyPickerText}>No channels available. Connect a playlist first.</Text>
              </View>
            ) : (
              <FlatList
                data={filteredChannels}
                keyExtractor={(c) => c.streamId}
                renderItem={({ item }) => (
                  <Pressable
                    style={({ pressed }) => [styles.channelPickItem, pressed && { opacity: 0.7 }]}
                    onPress={() => selectChannel(item)}
                  >
                    <View style={styles.channelPickLogo}>
                      {item.streamIcon ? (
                        <Image source={{ uri: item.streamIcon }} style={{ width: 32, height: 32 }} resizeMode="contain" />
                      ) : (
                        <Ionicons name="tv" size={20} color={Colors.textMuted} />
                      )}
                    </View>
                    <Text style={styles.channelPickName} numberOfLines={1}>{item.name}</Text>
                    <Ionicons name="play-circle-outline" size={20} color={Colors.accent} />
                  </Pressable>
                )}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        </View>
      </Modal>
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
    paddingBottom: 16,
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
    flex: 1,
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  modeToggle: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 3,
    gap: 3,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  modeBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 7,
    gap: 4,
  },
  modeBtnActive: {
    backgroundColor: Colors.accentSoft,
  },
  modeBtnText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textMuted,
  },
  modeBtnTextActive: {
    color: Colors.accent,
  },
  grid: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    paddingHorizontal: 4,
  },
  grid4: {},
  screenSlot: {
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: Colors.surface,
  },
  slot2: {
    flex: 1,
    height: 220,
  },
  slot4: {
    width: "49%",
    height: 180,
  },
  slotFilled: {
    flex: 1,
    backgroundColor: "#000",
  },
  slotVideo: {
    flex: 1,
  },
  slotOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 8,
  },
  slotInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  slotLogo: {
    width: 20,
    height: 20,
  },
  slotName: {
    flex: 1,
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "#fff",
  },
  slotCloseBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  slotExpandBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  slotEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 2,
    borderColor: Colors.cardBorder,
    borderStyle: "dashed",
    borderRadius: 10,
  },
  slotEmptyText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
  },
  slotNum: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    maxHeight: "70%",
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  channelPickItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  channelPickLogo: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  channelPickName: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
  },
  emptyPicker: {
    padding: 32,
    alignItems: "center",
  },
  emptyPickerText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
  },
});
