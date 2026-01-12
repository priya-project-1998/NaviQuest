import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Switch, ScrollView, Alert, Linking, Platform } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { check, request, PERMISSIONS, RESULTS, openSettings } from 'react-native-permissions';

const SettingsScreen = () => {
  const [locationPermission, setLocationPermission] = useState(false);

  // ...existing code...

  const handleLocationPermission = async (value) => {
    const perm = Platform.OS === 'android' ? PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION : PERMISSIONS.IOS.LOCATION_WHEN_IN_USE;
    if (!perm) {
      Alert.alert('Not supported', 'This permission is not available on your platform.');
      return;
    }
    if (value) {
      const result = await request(perm);
      setLocationPermission(result === RESULTS.GRANTED);
    } else {
      // Simply disable location permission in local state
      setLocationPermission(false);
    }
  };

  useEffect(() => {
    const checkLocationPermission = async () => {
      const locationPerm = Platform.OS === 'android' ? PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION : PERMISSIONS.IOS.LOCATION_WHEN_IN_USE;
      if (locationPerm) {
        const result = await check(locationPerm);
        setLocationPermission(result === RESULTS.GRANTED);
      }
    };
    checkLocationPermission();
  }, []);

  return (
    <LinearGradient colors={["#0f2027", "#203a43", "#2c5364"]} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.heading}>Permissions</Text>

        {/* Location Permission */}
        <View style={styles.permissionCard}>
          <View style={styles.permissionHeader}>
            <Text style={styles.permissionTitle}>📍 Location Access</Text>
            <Switch
              value={locationPermission}
              onValueChange={handleLocationPermission}
              thumbColor={locationPermission ? "#4CAF50" : "#ccc"}
              trackColor={{ false: "#666", true: "#81C784" }}
            />
          </View>
          <Text style={styles.permissionDescription}>
            Enables real-time GPS tracking to determine your current location on the map and detect when you reach event checkpoints.
          </Text>
          <Text style={[styles.permissionStatus, { color: locationPermission ? "#4CAF50" : "#FF9800" }]}>
            {locationPermission ? "✓ Enabled" : "⚠ Disabled"}
          </Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  heading: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 10,
  },
  description: {
    fontSize: 14,
    color: "#ccc",
    marginBottom: 25,
    lineHeight: 20,
  },
  permissionCard: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#4CAF50",
    marginBottom: 15,
  },
  permissionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    flex: 1,
  },
  permissionDescription: {
    fontSize: 13,
    color: "#b0bec5",
    lineHeight: 18,
    marginBottom: 10,
  },
  permissionStatus: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 8,
  },
});

export default SettingsScreen;
