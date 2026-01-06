import React from "react";
import { ScrollView, Text, StyleSheet, View } from "react-native";

const AboutScreen = () => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      
      <Text style={styles.section}>
        Welcome to NaviQuest - your ultimate platform for organizing,
        participating, and experiencing NaviQuest events across India. Whether
        it's car, bike challenges, or walking marathons, NaviQuest brings
        thrilling competitions and unique experiences to your fingertips.
      </Text>

      <Text style={styles.section}>
        The app is designed for 18+ users in India who are passionate about
        speed, endurance, and adventure. Participants can join events in various
        locations, compete for exciting prizes, and enjoy a professional event
        tracking experience.
      </Text>

      <Text style={styles.subHeading}>Key Features:</Text>

      {[
        "Create and manage events as an organiser",
        "View upcoming and completed event details",
        "Live checkpoints and performance tracking",
        "User profile management with photo upload",
        "Rate, review, and provide feedback on events",
        "Share invitations with friends via WhatsApp or other apps",
        "Search events and view past results",
        "Manage permissions for storage, location, and notifications",
      ].map((item, index) => (
        <View style={styles.bulletWrapper} key={index}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}

      <Text style={styles.subHeading}>Our Mission:</Text>
      <Text style={styles.section}>
        At NaviQuest, we aim to create a community of motorsports and adventure
        enthusiasts by providing a reliable, easy-to-use platform for event
        creation and participation. Our goal is to ensure every event delivers
        fair competition, fun, and unforgettable experiences.
      </Text>

      <Text style={styles.footer}>
        Verson 1.0.0 | Developed by Rajasthan Motorsports © 2025
      </Text>

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f2027",
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
    marginBottom: 10,
  },
  section: {
    fontSize: 15,
    color: "#fff",
    lineHeight: 22,
    marginBottom: 10,
  },
  bulletWrapper: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6,
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

export default AboutScreen;
