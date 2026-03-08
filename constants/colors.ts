const accent = "#4F8EF7";
const accentDim = "#2563C9";
const danger = "#FF4D4F";
const success = "#36D399";
const warning = "#F59E0B";

const C = {
  bg: "#0A0A12",
  surface: "#13131D",
  card: "#1A1A26",
  cardBorder: "#252535",
  accent,
  accentDim,
  accentSoft: "rgba(79,142,247,0.15)",
  danger,
  success,
  warning,
  text: "#F0F0F8",
  textSecondary: "#8888A0",
  textMuted: "#555568",
  border: "#1E1E2E",
  overlay: "rgba(0,0,0,0.7)",
  gradient1: "#4F8EF7",
  gradient2: "#7C3AED",
};

export default {
  light: {
    tint: accent,
    tabIconDefault: "#555568",
    tabIconSelected: accent,
  },
  dark: {
    tint: accent,
    tabIconDefault: "#555568",
    tabIconSelected: accent,
  },
  ...C,
};
