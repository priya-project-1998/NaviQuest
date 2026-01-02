import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  Share,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";

const InviteUserScreen = () => {
  const [inviteTo, setInviteTo] = useState("");
  const [message, setMessage] = useState("");

  const handleInvite = () => {
    if (!inviteTo.trim()) {
      Alert.alert("Error", "Please enter an email or phone number to invite.");
      return;
    }
    Alert.alert("Invitation Sent", `Invitation sent to: ${inviteTo}`);
    setInviteTo("");
    setMessage("");
  };

  const handleShareApp = async () => {
    try {
      await Share.share({
        message:
          "Join us on NaviQuest Experience amazing Trail Hunt events in India. \nDownload here: https://rajasthanmotorsports.com/download",
      });
    } catch (error) {
      Alert.alert("Error", "Unable to share the app link.");
    }
  };

  return (
    <LinearGradient colors={["#0f2027", "#203a43", "#2c5364"]} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.container}>
          <Text style={styles.heading}>Invite a Friend</Text>
          <Text style={styles.subHeading}>
            Share the excitement of NaviQuest with your friends! Invite them to join and experience racing events.
          </Text>

          {/* Email or Phone Input */}
          <TextInput
            style={styles.input}
            placeholder="Enter friend's email or phone number"
            placeholderTextColor="#aaa"
            value={inviteTo}
            onChangeText={setInviteTo}
            keyboardType="email-address"
          />

          {/* Optional Message */}
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Add a personal message (optional)"
            placeholderTextColor="#aaa"
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={4}
          />

          {/* Invite Button */}
          <TouchableOpacity onPress={handleInvite} style={{ width: "100%", marginTop: 20 }}>
            <LinearGradient colors={["#ff7e5f", "#feb47b"]} style={styles.inviteButton}>
              <Text style={styles.inviteText}>Send Invitation</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Share App Link Button */}
          <TouchableOpacity onPress={handleShareApp} style={{ width: "100%", marginTop: 15 }}>
            <LinearGradient colors={["#36D1DC", "#5B86E5"]} style={styles.inviteButton}>
              <Text style={styles.inviteText}>Share App Link</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  container: {
    width: "100%",
    alignItems: "center",
  },
  heading: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#ff7e5f",
    marginBottom: 10,
    textAlign: "center",
  },
  subHeading: {
    fontSize: 16,
    color: "#fff",
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 10,
    padding: 10,
    color: "#fff",
    fontSize: 14,
    marginBottom: 15,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  inviteButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  inviteText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
});

export default InviteUserScreen;
