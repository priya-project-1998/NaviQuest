import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";

const FeedbackScreen = () => {
  const [feedback, setFeedback] = useState("");

  const handleSubmit = () => {
    if (!feedback.trim()) {
      Alert.alert("Error", "Please enter your feedback or suggestions");
      return;
    }
    // Here you could send the feedback to your backend or store locally
    Alert.alert("Thank You!", "Your feedback has been submitted.");
    setFeedback("");
  };

  return (
    <LinearGradient colors={["#0f2027", "#203a43", "#2c5364"]} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <Text style={styles.heading}>Feedback</Text>
          <Text style={styles.subHeading}>
            We value your feedback! Let us know your thoughts and suggestions.
          </Text>

          {/* Feedback Input */}
          <TextInput
            style={styles.input}
            placeholder="Enter your feedback and suggestion..."
            placeholderTextColor="#aaa"
            value={feedback}
            onChangeText={setFeedback}
            multiline
            numberOfLines={4}
          />

          {/* Submit Button */}
          <TouchableOpacity onPress={handleSubmit} style={{ width: "100%", marginTop: 20 }}>
            <LinearGradient colors={["#ff7e5f", "#feb47b"]} style={styles.submitButton}>
              <Text style={styles.submitText}>Submit</Text>
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
    minHeight: 120,
    textAlignVertical: "top",
  },
  submitButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  submitText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
});

export default FeedbackScreen;
