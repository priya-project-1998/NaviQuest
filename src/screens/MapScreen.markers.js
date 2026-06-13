// Marker components rendered inside MapScreen's <MapView>.
// Kept here so the main file isn't dominated by per-pixel View layouts.

import React, { useRef, useImperativeHandle } from "react";
import { View, Animated } from "react-native";
import { Marker, AnimatedRegion } from "react-native-maps";
import styles from "./MapScreen.styles";
import { getMarkerColorByPoint } from "../utils/mapHelpers";

// Smooth car marker driven entirely via ref.updatePosition() — never re-renders from
// parent state so GPS ticks cannot interrupt an in-progress animation.
// React.memo second arg `() => true` ensures the component is mounted once and
// stays alive regardless of what MapScreen re-renders (speed HUD, timer, overspeed, etc.).
export const UserCarMarker = React.memo(
  React.forwardRef(({ initialCoordinate }, ref) => {
    // AnimatedRegion is the native bridge for smooth lat/lng transitions.
    // Created once at mount from the first valid GPS fix.
    const animatedCoord = useRef(
      new AnimatedRegion({
        latitude: initialCoordinate.latitude,
        longitude: initialCoordinate.longitude,
        latitudeDelta: 0,
        longitudeDelta: 0,
      })
    ).current;

    // Accumulated rotation — may exceed ±360 to avoid wrap-around snapping.
    const rotationAnim = useRef(new Animated.Value(0)).current;
    // Tracks accumulated value so each tick applies the correct shortest-arc delta.
    const prevHeadingRef = useRef(0);

    // Expose imperative API so the GPS watch can push updates without going through
    // React state → parent render → child render cycle.
    useImperativeHandle(ref, () => ({
      updatePosition: (lat, lng, heading, speed) => {
        // Position: 900ms so the animation is always mid-flight when the next GPS
        // tick arrives — marker continuously glides toward latest fix instead of stepping.
        animatedCoord.timing({
          latitude: lat,
          longitude: lng,
          duration: 900,
          useNativeDriver: false,
        }).start();

        // Skip heading at standstill — GPS heading is junk below ~1 km/h and
        // resetting it to 0 (north) is what causes the "tedi" snap.
        if (speed < 1) return;

        // Shortest-arc delta with 75°/tick cap — prevents sudden 90° snaps from
        // GPS multipath noise without causing visible lag on normal road curves.
        const prev = prevHeadingRef.current;
        const normalizedH = ((heading || 0) % 360 + 360) % 360;
        const normalizedP = ((prev % 360) + 360) % 360;
        let diff = normalizedH - normalizedP;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        const clampedDiff = Math.max(-75, Math.min(75, diff));
        const target = prev + clampedDiff;

        Animated.timing(rotationAnim, {
          toValue: target,
          duration: 900, // match position duration — constant at any speed
          useNativeDriver: true,
        }).start();
        prevHeadingRef.current = target;
      },
    }));

    const rotate = rotationAnim.interpolate({
      inputRange: [-720, 0, 720],
      outputRange: ['-720deg', '0deg', '720deg'],
      extrapolate: 'extend',
    });

    return (
      <Marker.Animated
        coordinate={animatedCoord}
        anchor={{ x: 0.5, y: 0.5 }}
        flat
        tracksViewChanges={false}
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
  }),
  () => true // never re-render from parent — all updates are imperative via ref
);

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
