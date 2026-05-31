// Marker components rendered inside MapScreen's <MapView>.
// Kept here so the main file isn't dominated by per-pixel View layouts.

import React from "react";
import { View, Platform } from "react-native";
import { Marker } from "react-native-maps";
import styles from "./MapScreen.styles";
import { getMarkerColorByPoint } from "../utils/mapHelpers";

// Red car marker for the user's live location. `rotation` faces direction of travel
// so the car points where the participant is moving (works the same on iOS & Android
// when `flat={true}`).
export const UserCarMarker = ({ coordinate, heading }) => (
  <Marker
    coordinate={coordinate}
    title="📍 My Location"
    description="Your current position"
    anchor={{ x: 0.5, y: 0.5 }}
    flat
    rotation={heading}
  >
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
  </Marker>
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
