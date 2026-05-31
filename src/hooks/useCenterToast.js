// Self-contained "center-of-screen toast" hook.
// Owns its state, the show() trigger, the pure icon/color tables, and the JSX element so
// any screen can show toasts with two lines:
//     const { show, Toast } = useCenterToast();
//     ...                                <Toast />   {/* placed once in the tree */}
//     show('Saved!', 'success');         // call from anywhere

import React, { useCallback, useRef, useState } from "react";
import { View, Text } from "react-native";
import styles from "../screens/MapScreen.styles";

// Pure lookups — declared at module scope so they're not re-created per render.
const TOAST_ICONS = {
  success: "✓",
  error: "✗",
  warning: "⚠",
  info: "ℹ",
};
const TOAST_COLORS = {
  success: "#4CAF50",
  error: "#F44336",
  warning: "#FF9800",
  info: "#2196F3",
};
// Keep toasts short so they don't linger on screen. Success is a touch longer than the
// rest so the synced-checkpoint name is still readable, but nowhere near the old 10s.
const TOAST_DURATIONS = { success: 3500 };
const DEFAULT_TOAST_DURATION = 3000;

export const useCenterToast = () => {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [type, setType] = useState("success");
  // Guard so a fast second call's auto-hide timer doesn't kill the newer toast early.
  const hideTimerRef = useRef(null);

  // `durationOverride` (ms) is optional — callers that want a shorter/longer toast can
  // pass it. Existing callers (MapScreen) omit it and keep the per-type defaults.
  const show = useCallback((msg, t = "success", durationOverride) => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setMessage(msg);
    setType(t);
    setVisible(true);
    const duration = durationOverride || TOAST_DURATIONS[t] || DEFAULT_TOAST_DURATION;
    hideTimerRef.current = setTimeout(() => setVisible(false), duration);
  }, []);

  const Toast = useCallback(() => {
    if (!visible) return null;
    const color = TOAST_COLORS[type] || TOAST_COLORS.success;
    const icon = TOAST_ICONS[type] || TOAST_ICONS.success;
    return (
      <View style={[styles.toastContainer, { borderLeftColor: color }]}>
        <View style={[toastInner.iconBadge, { backgroundColor: color }]}>
          <Text style={toastInner.iconText}>{icon}</Text>
        </View>
        <Text style={styles.toastText}>{message}</Text>
      </View>
    );
  }, [visible, type, message]);

  return { show, Toast };
};

// Small inline styles kept here so the toast is self-contained — the parent style file
// only defines the outer container + text rules that pre-existed.
const toastInner = {
  iconBadge: {
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  iconText: { fontSize: 14, color: "#fff", fontWeight: "bold" },
};
