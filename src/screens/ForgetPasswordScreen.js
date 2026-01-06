import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Icon from "react-native-vector-icons/Feather";
import AuthService from "../services/apiService/auth_service";

export default function ForgetPasswordScreen({ navigation }) {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // 🔹 Step 1 → Request OTP
  const handleRequestOtp = async () => {
    if (!email) {
      Alert.alert("Error", "Please enter your email");
      return;
    }
    try {
      setLoading(true);
      const response = await AuthService.requestOTP(email);
      setLoading(false);

      if (response.status === "success") {
        Alert.alert("OTP Sent", response.message || "Check your email for OTP");
        setStep(2);
      } else {
        Alert.alert("Error", response.message || "Failed to send OTP");
      }
    } catch (err) {
      setLoading(false);
      Alert.alert("Error", "Something went wrong, try again later");
    }
  };

  // 🔹 Step 2 → Reset Password
  const handleResetPassword = async () => {
    if (!otp || !password) {
      Alert.alert("Error", "Please enter OTP and new password");
      return;
    }
    try {
      setLoading(true);
      const response = await AuthService.resetPassword(email, otp, password);
      setLoading(false);

      if (response.status === "success") {
        Alert.alert("Success", response.message || "Password reset successfully", [
          {
            text: "OK",
            onPress: () => navigation.goBack(),
          },
        ]);
      } else {
        Alert.alert("Error", response.message || "Failed to reset password");
      }
    } catch (err) {
      setLoading(false);
      Alert.alert("Error", "Something went wrong, try again later");
    }
  };

  // 🔹 Step Indicator Component
  const StepIndicator = ({ number, label, active }) => (
    <View style={styles.stepContainer}>
      {active ? (
        <LinearGradient colors={["#4facfe", "#00f2fe"]} style={styles.activeStepCircle}>
          <Text style={styles.stepNumber}>{number}</Text>
        </LinearGradient>
      ) : (
        <View style={styles.inactiveStepCircle}>
          <Text style={styles.stepNumber}>{number}</Text>
        </View>
      )}
      <Text style={[styles.stepLabel, active && { color: "#4facfe" }]}>{label}</Text>
    </View>
  );

  return (
    <LinearGradient colors={["#0f2027", "#203a43", "#2c5364"]} style={styles.gradient}>
      <View style={styles.card}>
        <Text style={styles.title}>Reset Password</Text>

        {/* Stepper */}
        <View style={styles.stepperRow}>
          <StepIndicator number="1" label="Request OTP" active={step === 1} />
          <View style={styles.stepLine} />
          <StepIndicator number="2" label="Reset Password" active={step === 2} />
        </View>

        {/* Email Input */}
        <View style={styles.inputContainer}>
          <Icon name="mail" size={20} color="#ccc" style={styles.icon} />
          <TextInput
            style={[styles.input, step === 2 && { color: "#bbb" }]}
            placeholder="Enter Email"
            placeholderTextColor="#aaa"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={step === 1 ? setEmail : undefined}
            editable={step === 1}
          />
        </View>

        {step === 1 ? (
          <TouchableOpacity activeOpacity={0.8} onPress={handleRequestOtp}>
            <LinearGradient colors={["#4facfe", "#00f2fe"]} style={styles.button}>
              <Text style={styles.buttonText}>Request OTP</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <>
            {/* OTP Input */}
            <View style={styles.inputContainer}>
              <Icon name="key" size={20} color="#ccc" style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="Enter OTP"
                placeholderTextColor="#aaa"
                keyboardType="numeric"
                value={otp}
                onChangeText={setOtp}
              />
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Icon name="lock" size={20} color="#ccc" style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="Enter New Password"
                placeholderTextColor="#aaa"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Icon name={showPassword ? "eye-off" : "eye"} size={20} color="#ccc" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity activeOpacity={0.8} onPress={handleResetPassword}>
              <LinearGradient colors={["#4facfe", "#00f2fe"]} style={styles.button}>
                <Text style={styles.buttonText}>Reset Password</Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}

        {/* Back to Login */}
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={[styles.link, { color: "#36D1DC" }]}>Back to Login</Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#4facfe" />
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1, justifyContent: "center" },
  card: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
    marginBottom: 20,
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  stepContainer: { alignItems: "center" },
  activeStepCircle: {
    width: 35,
    height: 35,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 5,
  },
  inactiveStepCircle: {
    width: 35,
    height: 35,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#888",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 5,
  },
  stepNumber: { color: "#fff", fontWeight: "bold" },
  stepLabel: { color: "#aaa", fontSize: 12 },
  stepLine: {
    height: 2,
    flex: 1,
    backgroundColor: "#888",
    marginHorizontal: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 10,
    marginVertical: 8,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  icon: { marginRight: 10 },
  input: { flex: 1, color: "#fff", fontSize: 16 },
  button: { paddingVertical: 14, borderRadius: 10, marginTop: 15 },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 18, textAlign: "center" },
  backButton: { marginTop: 12, alignItems: "center" },
  link: { fontSize: 16, fontWeight: "600" },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
});
