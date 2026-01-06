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

const RateUsScreen = () => {
  const [rating, setRating] = useState(null);
  const [feedback, setFeedback] = useState("");

  const handleSubmit = () => {
    if (!rating) {
      Alert.alert("Error", "Please select a rating between 1 and 10");
      return;
    }
    if (!feedback.trim()) {
      Alert.alert("Error", "Please enter your feedback or suggestions");
      return;
    }
    Alert.alert("Thank You!", `You rated ${rating}/5.\nYour feedback has been submitted.`);
    setRating(null);
    setFeedback("");
  };

  return (
    <LinearGradient colors={["#0f2027", "#203a43", "#2c5364"]} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <Text style={styles.heading}>Rate Us</Text>
          <Text style={styles.subHeading}>How would you rate your experience?</Text>

          {/* Rating Buttons */}
          <View style={styles.ratingContainer}>
            {Array.from({ length: 5 }, (_, i) => i + 1).map((num) => (
              <TouchableOpacity
                key={num}
                style={[styles.ratingButton, rating === num && styles.selectedButton]}
                onPress={() => setRating(num)}
              >
                <Text style={[styles.ratingText, rating === num && styles.selectedText]}>
                  {num}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Feedback Input */}
          <TextInput
            style={styles.input}
            placeholder="Your journey experience is valuable to us, please share your experience..."
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
  ratingContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginBottom: 20,
  },
  ratingButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    margin: 5,
  },
  selectedButton: {
    backgroundColor: "#ff7e5f",
    borderColor: "#ff7e5f",
  },
  ratingText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  selectedText: {
    color: "#fff",
  },
  input: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 10,
    padding: 10,
    color: "#fff",
    fontSize: 14,
    minHeight: 80,
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

export default RateUsScreen;
