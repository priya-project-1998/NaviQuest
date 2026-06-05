// Marker components rendered inside MapScreen's <MapView>.
// Kept here so the main file isn't dominated by per-pixel View layouts.

import React, { useRef, useEffect } from "react";
import { View, Animated } from "react-native";
import { Marker, AnimatedRegion } from "react-native-maps";
import styles from "./MapScreen.styles";
import { getMarkerColorByPoint } from "../utils/mapHelpers";

// Red car marker for the user's live location.
// Uses AnimatedRegion so GPS ticks slide the marker instead of teleporting it.
// Uses Animated.Value for rotation so heading changes animate smoothly with
// correct wrap-around handling at the 0/360 boundary.
export const UserCarMarker = React.memo(({ coordinate, heading, speed = 0 }) => {
  // Created once per mount — AnimatedRegion owns the live lat/lng for the marker.
  const animatedCoord = useRef(
    new AnimatedRegion({
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
      latitudeDelta: 0,
      longitudeDelta: 0,
    })
  ).current;

  // Accumulated rotation value (may exceed 0-360 to avoid wrap-around snapping).
  const rotationAnim = useRef(new Animated.Value(heading || 0)).current;
  // Tracks the accumulated value so we can compute the shortest-arc delta.
  const prevHeadingRef = useRef(heading || 0);

  // Animate marker position on each GPS tick — no more teleporting.
  // animatedCoord.timing works cross-platform (JS-driven, no native-ref needed).
  useEffect(() => {
    animatedCoord.timing({
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [coordinate.latitude, coordinate.longitude]);

  // Animate rotation on heading change. Computes shortest arc so the car
  // never spins the long way round at the 0↔360 boundary.
  // Skip when stationary (<1 km/h) — prevents random 360° resets at standstill.
  useEffect(() => {
    if (speed < 1) return;
    const toValue = heading || 0;
    const prev = prevHeadingRef.current;
    let diff = toValue - prev;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    const target = prev + diff;
    Animated.timing(rotationAnim, { toValue: target, duration: 300, useNativeDriver: true }).start();
    prevHeadingRef.current = target;
  }, [heading]);

  const rotate = rotationAnim.interpolate({
    inputRange: [-720, 0, 720],
    outputRange: ['-720deg', '0deg', '720deg'],
    extrapolate: 'extend',
  });

  return (
    <Marker.Animated
      coordinate={animatedCoord}
      title="📍 My Location"
      description="Your current position"
      anchor={{ x: 0.5, y: 0.5 }}
      flat
    >
      <Animated.View style={{ transform: [{ rotate }] }}>
        <View style={carStyles.frame}>
          <View style={carStyles.body}>
            <View style={carStyles.frontBumper} />
            <View style={carStyles.frontWindshield} />
            <View style={carStyles.mirrorLeft} />
            <View style={carStyles.mirrorRight} />
            <View style={carStyles.mainBody} />
            <View style={carStyles.rearWindshield} />
            <View style={carStyles.rearBumper} />
          </View>
        </View>
      </Animated.View>
    </Marker.Animated>
  );
});

// One pin per event checkpoint. The color comes from `checkpoint_point` (mapped via
// getMarkerColorByPoint) and flips to blue once the participant has completed it
// (except for START / FINISH which keep their identity colors).
// iOS quirk: react-native-maps' `pinColor` only honors a few named colors on iOS,
// so we render a custom View child for iOS while Android keeps using the native pin.
export const CheckpointPin = ({ checkpoint, completed }) => {
  const cpPoint = parseInt(checkpoint.checkpoint_point, 10);
  const nameUpper = (checkpoint.checkpoint_name || '').trim().toUpperCase();
  const isFixedMarker = cpPoint === 1000 || cpPoint === 2000
    || nameUpper.startsWith('START') || nameUpper.startsWith('FINISH');
  const markerColor = (!isFixedMarker && completed)
    ? '#185a9d' // blue once a regular/mandatory checkpoint has been completed
    : getMarkerColorByPoint(checkpoint.checkpoint_point, checkpoint.checkpoint_name);

  return (
    <Marker
      key={`${checkpoint.checkpoint_id}-${completed ? 'completed' : 'pending'}`}
      testID={`marker-${checkpoint.checkpoint_id}`}
      coordinate={{
        latitude: parseFloat(checkpoint.latitude),
        longitude: parseFloat(checkpoint.longitude),
      }}
      title={checkpoint.checkpoint_name}
      {...(Platform.OS === 'android' ? { pinColor: markerColor } : {})}
      anchor={Platform.OS === 'ios' ? { x: 0.5, y: 1 } : undefined}
    >
      {Platform.OS === 'ios' && (
        <View style={styles.customPinWrapper}>
          <View style={[styles.customPinHead, { backgroundColor: markerColor }]}>
            <View style={styles.customPinInnerDot} />
          </View>
          <View style={[styles.customPinTail, { borderTopColor: markerColor }]} />
        </View>
      )}
    </Marker>
  );
};

// Car icon — pure layout, no logic. Built out of overlapping Views to look like a
// top-down red car (front bumper / windshield / mirrors / body / rear) without an SVG dep.
const carStyles = {
  frame: { width: 36, height: 63, justifyContent: 'center', alignItems: 'center' },
  body: {
    width: 27, height: 42, backgroundColor: '#FF0000',
    borderRadius: 12, borderWidth: 2, borderColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.5, shadowOffset: { width: 0, height: 4 },
    elevation: 8, overflow: 'hidden',
  },
  frontBumper: {
    position: 'absolute', top: 0, left: 3, right: 3, height: 6,
    backgroundColor: '#fff', borderTopLeftRadius: 8, borderTopRightRadius: 8,
  },
  frontWindshield: {
    position: 'absolute', top: 6, left: 4, right: 4, height: 9,
    backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 2,
  },
  mirrorLeft: {
    position: 'absolute', top: 12, left: -2, width: 4, height: 6,
    backgroundColor: '#B30000', borderRadius: 2,
  },
  mirrorRight: {
    position: 'absolute', top: 12, right: -2, width: 4, height: 6,
    backgroundColor: '#B30000', borderRadius: 2,
  },
  mainBody: {
    position: 'absolute', top: 15, left: 2, right: 2, height: 18,
    backgroundColor: '#FF0000',
  },
  rearWindshield: {
    position: 'absolute', bottom: 6, left: 5, right: 5, height: 6,
    backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 2,
  },
  rearBumper: {
    position: 'absolute', bottom: 0, left: 4, right: 4, height: 5,
    backgroundColor: '#990000', borderBottomLeftRadius: 6, borderBottomRightRadius: 6,
  },
};
