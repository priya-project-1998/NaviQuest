import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Switch, ScrollView, Alert, Linking, Platform } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { check, request, PERMISSIONS, RESULTS, openSettings } from 'react-native-permissions';

const SettingsScreen = () => {
  const [storagePermission, setStoragePermission] = useState(false);
  const [locationPermission, setLocationPermission] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState(false);
  const [cameraPermission, setCameraPermission] = useState(false);
  const [microphonePermission, setMicrophonePermission] = useState(false);

  // Helper to open app settings
  const goToSettings = () => {
    Alert.alert(
      'Permission Required',
      'To disable this permission, please go to app settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => openSettings() },
      ]
    );
  };

  // Helper to show custom popup for disabling
  const showDisablePopup = () => {
    Alert.alert(
      'Permission Cannot Be Disabled Here',
      'You can only revoke this permission from app settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Go to Settings', onPress: () => openSettings() },
      ]
    );
  };

  // Permission handlers
  const handleStoragePermission = async (value) => {
    let perm;
    if (Platform.OS === 'android') {
      if (Platform.Version >= 33) {
        // Android 13+ granular media permissions
        perm = PERMISSIONS.ANDROID.READ_MEDIA_IMAGES;
      } else {
        perm = PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE;
      }
    } else {
      perm = PERMISSIONS.IOS.PHOTO_LIBRARY;
    }
    if (!perm) {
      Alert.alert('Not supported', 'This permission is not available on your platform.');
      return;
    }
    if (value) {
      const result = await request(perm);
      setStoragePermission(result === RESULTS.GRANTED);
    } else {
      showDisablePopup();
    }
  };

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
      showDisablePopup();
    }
  };

  const handleNotificationPermission = async (value) => {
    const perm = Platform.OS === 'android' ? PERMISSIONS.ANDROID.POST_NOTIFICATIONS : PERMISSIONS.IOS.NOTIFICATIONS;
    if (!perm) {
      Alert.alert('Not supported', 'This permission is not available on your platform.');
      return;
    }
    if (value) {
      const result = await request(perm);
      setNotificationPermission(result === RESULTS.GRANTED);
    } else {
      showDisablePopup();
    }
  };

  const handleCameraPermission = async (value) => {
    const perm = Platform.OS === 'android' ? PERMISSIONS.ANDROID.CAMERA : PERMISSIONS.IOS.CAMERA;
    if (!perm) {
      Alert.alert('Not supported', 'This permission is not available on your platform.');
      return;
    }
    if (value) {
      const result = await request(perm);
      setCameraPermission(result === RESULTS.GRANTED);
    } else {
      showDisablePopup();
    }
  };

  const handleMicrophonePermission = async (value) => {
    const perm = Platform.OS === 'android' ? PERMISSIONS.ANDROID.RECORD_AUDIO : PERMISSIONS.IOS.MICROPHONE;
    if (!perm) {
      Alert.alert('Not supported', 'This permission is not available on your platform.');
      return;
    }
    if (value) {
      const result = await request(perm);
      setMicrophonePermission(result === RESULTS.GRANTED);
    } else {
      showDisablePopup();
    }
  };

  useEffect(() => {
    const checkAllPermissions = async () => {
      // Storage
      let storagePerm;
      if (Platform.OS === 'android') {
        if (Platform.Version >= 33) {
          storagePerm = PERMISSIONS.ANDROID.READ_MEDIA_IMAGES;
        } else {
          storagePerm = PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE;
        }
      } else {
        storagePerm = PERMISSIONS.IOS.PHOTO_LIBRARY;
      }
      if (storagePerm) {
        const result = await check(storagePerm);
        setStoragePermission(result === RESULTS.GRANTED);
      }
      // Location
      const locationPerm = Platform.OS === 'android' ? PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION : PERMISSIONS.IOS.LOCATION_WHEN_IN_USE;
      if (locationPerm) {
        const result = await check(locationPerm);
        setLocationPermission(result === RESULTS.GRANTED);
      }
      // Notification
      const notifPerm = Platform.OS === 'android' ? PERMISSIONS.ANDROID.POST_NOTIFICATIONS : PERMISSIONS.IOS.NOTIFICATIONS;
      if (notifPerm) {
        const result = await check(notifPerm);
        setNotificationPermission(result === RESULTS.GRANTED);
      }
      // Camera
      const cameraPerm = Platform.OS === 'android' ? PERMISSIONS.ANDROID.CAMERA : PERMISSIONS.IOS.CAMERA;
      if (cameraPerm) {
        const result = await check(cameraPerm);
        setCameraPermission(result === RESULTS.GRANTED);
      }
      // Microphone
      const micPerm = Platform.OS === 'android' ? PERMISSIONS.ANDROID.RECORD_AUDIO : PERMISSIONS.IOS.MICROPHONE;
      if (micPerm) {
        const result = await check(micPerm);
        setMicrophonePermission(result === RESULTS.GRANTED);
      }
    };
    checkAllPermissions();
  }, []);

  return (
    <LinearGradient colors={["#0f2027", "#203a43", "#2c5364"]} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.heading}>Permission</Text>

        {/* Storage Permission */}
        <View style={styles.settingRow}>
          <Text style={styles.settingText}>Storage Permission</Text>
          <Switch
            value={storagePermission}
            onValueChange={handleStoragePermission}
            thumbColor={storagePermission ? "#ff7e5f" : "#ccc"}
            trackColor={{ false: "#666", true: "#feb47b" }}
          />
        </View>

        {/* Location Permission */}
        <View style={styles.settingRow}>
          <Text style={styles.settingText}>Location Permission</Text>
          <Switch
            value={locationPermission}
            onValueChange={handleLocationPermission}
            thumbColor={locationPermission ? "#ff7e5f" : "#ccc"}
            trackColor={{ false: "#666", true: "#feb47b" }}
          />
        </View>

        {/* Notification Permission */}
        <View style={styles.settingRow}>
          <Text style={styles.settingText}>Notification Permission</Text>
          <Switch
            value={notificationPermission}
            onValueChange={handleNotificationPermission}
            thumbColor={notificationPermission ? "#ff7e5f" : "#ccc"}
            trackColor={{ false: "#666", true: "#feb47b" }}
          />
        </View>

        {/* Camera Permission */}
        <View style={styles.settingRow}>
          <Text style={styles.settingText}>Camera Permission</Text>
          <Switch
            value={cameraPermission}
            onValueChange={handleCameraPermission}
            thumbColor={cameraPermission ? "#ff7e5f" : "#ccc"}
            trackColor={{ false: "#666", true: "#feb47b" }}
          />
        </View>

        {/* Microphone Permission */}
        <View style={styles.settingRow}>
          <Text style={styles.settingText}>Microphone Permission</Text>
          <Switch
            value={microphonePermission}
            onValueChange={handleMicrophonePermission}
            thumbColor={microphonePermission ? "#ff7e5f" : "#ccc"}
            trackColor={{ false: "#666", true: "#feb47b" }}
          />
        </View>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { padding: 15 },
  heading: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 15,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  settingText: {
    fontSize: 16,
    color: "#fff",
  },
});

export default SettingsScreen;
