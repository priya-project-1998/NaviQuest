import React from "react";
import { ScrollView, Text, StyleSheet, View } from "react-native";

const LocationPermissionPolicyScreen = () => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>NaviQuest - Location Permission Policy</Text>

      <Text style={styles.section}>
        The NaviQuest app requires access to your device's location services to
        provide you with accurate event information, location-based
        recommendations, and better user experience.
      </Text>

      {/* ======================= SECTION 1 ======================= */}
      <Text style={styles.subHeading}>1. Why We Collect Location Data</Text>
      <View style={styles.bulletWrapper}>
        <Text style={styles.bullet}>•</Text>
        <Text style={styles.bulletText}>
          To help you find NaviQuest events near your current location.
        </Text>
      </View>
      <View style={styles.bulletWrapper}>
        <Text style={styles.bullet}>•</Text>
        <Text style={styles.bulletText}>
          To provide location-based notifications and updates.
        </Text>
      </View>
      <View style={styles.bulletWrapper}>
        <Text style={styles.bullet}>•</Text>
        <Text style={styles.bulletText}>
          To ensure accurate event start points and tracking.
        </Text>
      </View>

      {/* ======================= SECTION 2 ======================= */}
      <Text style={styles.subHeading}>2. How Location Data is Used</Text>
      <Text style={styles.section}>Your location information is used only within the app to:</Text>

      <View style={styles.bulletWrapper}>
        <Text style={styles.bullet}>•</Text>
        <Text style={styles.bulletText}>Show nearby events.</Text>
      </View>
      <View style={styles.bulletWrapper}>
        <Text style={styles.bullet}>•</Text>
        <Text style={styles.bulletText}>Guide you to event venues.</Text>
      </View>
      <View style={styles.bulletWrapper}>
        <Text style={styles.bullet}>•</Text>
        <Text style={styles.bulletText}>
          Enable safety and security features during events.
        </Text>
      </View>

      {/* ======================= SECTION 3 ======================= */}
      <Text style={styles.subHeading}>3. Data Storage & Security</Text>
      <View style={styles.bulletWrapper}>
        <Text style={styles.bullet}>•</Text>
        <Text style={styles.bulletText}>
          We do not store your real-time location permanently.
        </Text>
      </View>
      <View style={styles.bulletWrapper}>
        <Text style={styles.bullet}>•</Text>
        <Text style={styles.bulletText}>
          Location data is processed temporarily to provide services and is not
          shared with unauthorized third parties.
        </Text>
      </View>

      {/* ======================= SECTION 4 ======================= */}
      <Text style={styles.subHeading}>4. Your Control Over Location</Text>
      <View style={styles.bulletWrapper}>
        <Text style={styles.bullet}>•</Text>
        <Text style={styles.bulletText}>
          You can allow or deny location permissions in your device settings.
        </Text>
      </View>
      <View style={styles.bulletWrapper}>
        <Text style={styles.bullet}>•</Text>
        <Text style={styles.bulletText}>
          Denying location permissions may limit certain app features such as
          nearby event recommendations.
        </Text>
      </View>

      {/* ======================= SECTION 5 ======================= */}
      <Text style={styles.subHeading}>5. Compliance</Text>
      <Text style={styles.section}>
        NaviQuest complies with applicable privacy laws in India regarding the
        use of personal and location data. We request location access only when
        it is necessary for app functionality.
      </Text>

      {/* ======================= SECTION 6 ======================= */}
      <Text style={styles.subHeading}>6. Contact Us</Text>
      <Text style={styles.section}>
        If you have any questions regarding our location permission policy,
        please reach out to us via the in-app Help section.
      </Text>

      <Text style={styles.footer}>
        © 2025 Rajasthan Motorsports. All Rights Reserved.
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f2027", // dark teal theme
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  heading: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#ff7e5f",
    marginBottom: 15,
    textAlign: "center",
  },
  subHeading: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#feb47b",
    marginTop: 20,
    marginBottom: 8,
  },
  section: {
    fontSize: 15,
    color: "#ffffff",
    lineHeight: 22,
  },
  bulletWrapper: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6,
    marginTop: 2,
  },
  bullet: {
    fontSize: 18,
    color: "#fff",
    marginRight: 8,
  },
  bulletText: {
    flex: 1,
    fontSize: 15,
    color: "#fff",
    lineHeight: 22,
  },
  footer: {
    fontSize: 14,
    color: "#aaa",
    textAlign: "center",
    marginTop: 25,
  },
});

export default LocationPermissionPolicyScreen;
