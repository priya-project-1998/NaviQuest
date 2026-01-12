import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import AuthService from "../services/apiService/auth_service";

const { width, height } = Dimensions.get("window");

export default function ForgetPasswordScreen({ navigation }) {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // -------- Icon mapping for emojis --------
  const iconMap = {
    mail: "📧",
    key: "🔑",
    lock: "🔒",
  };

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
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
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
              <Text style={styles.iconText}>{iconMap.mail}</Text>
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
              <TouchableOpacity activeOpacity={0.8} onPress={handleRequestOtp} disabled={loading} style={styles.buttonWrapper}>
                <LinearGradient colors={["#36D1DC", "#5B86E5"]} style={styles.button}>
                  <Text style={styles.buttonText}>{loading ? "Sending..." : "Request OTP"}</Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <>
                {/* OTP Input */}
                <View style={styles.inputContainer}>
                  <Text style={styles.iconText}>{iconMap.key}</Text>
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
                  <Text style={styles.iconText}>{iconMap.lock}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter New Password"
                    placeholderTextColor="#aaa"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Text style={styles.iconText}>{showPassword ? "👁️" : "👁️‍🗨️"}</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity activeOpacity={0.8} onPress={handleResetPassword} disabled={loading} style={styles.buttonWrapper}>
                  <LinearGradient colors={["#36D1DC", "#5B86E5"]} style={styles.button}>
                    <Text style={styles.buttonText}>{loading ? "Resetting..." : "Reset Password"}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}

            {/* Back to Login */}
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Text style={[styles.link, { color: "#36D1DC" }]}>Back to Login</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#36D1DC" />
          </View>
        )}
      </LinearGradient>
    );
  }

const styles = StyleSheet.create({
  gradient: { 
    flex: 1 
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: width > 600 ? 40 : 20,
    paddingVertical: width > 600 ? 50 : 40,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: width > 600 ? 30 : 20,
    padding: width > 600 ? 40 : 20,
    width: "100%",
    maxWidth: 500,
    alignSelf: "center",
  },
  title: {
    fontSize: width > 600 ? 32 : 28,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
    marginBottom: width > 600 ? 25 : 15,
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: width > 600 ? 25 : 20,
  },
  stepContainer: { alignItems: "center" },
  activeStepCircle: {
    width: width > 600 ? 40 : 35,
    height: width > 600 ? 40 : 35,
    borderRadius: width > 600 ? 20 : 18,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 5,
  },
  inactiveStepCircle: {
    width: width > 600 ? 40 : 35,
    height: width > 600 ? 40 : 35,
    borderRadius: width > 600 ? 20 : 18,
    borderWidth: 2,
    borderColor: "#888",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 5,
  },
  stepNumber: { 
    color: "#fff", 
    fontWeight: "bold",
    fontSize: width > 600 ? 16 : 14,
  },
  stepLabel: { 
    color: "#aaa", 
    fontSize: width > 600 ? 13 : 12,
  },
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
    borderRadius: width > 600 ? 15 : 10,
    marginVertical: width > 600 ? 12 : 8,
    paddingHorizontal: width > 600 ? 15 : 10,
    paddingVertical: width > 600 ? 16 : 12,
  },
  icon: { 
    marginRight: 10 
  },
  iconText: {
    fontSize: width > 600 ? 24 : 20,
    marginRight: 8,
  },
  input: { 
    flex: 1, 
    color: "#fff", 
    fontSize: width > 600 ? 18 : 16,
    paddingVertical: Platform.OS === "ios" ? 8 : 0,
  },
  buttonWrapper: {
    minHeight: width > 600 ? 56 : 48,
    borderRadius: width > 600 ? 16 : 12,
    marginTop: width > 600 ? 28 : 20,
    marginBottom: width > 600 ? 20 : 15,
  },
  button: { 
    flex: 1,
    borderRadius: width > 600 ? 16 : 12,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#36D1DC",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonText: { 
    color: "#fff", 
    fontWeight: "700", 
    fontSize: width > 600 ? 18 : 16, 
    textAlign: "center",
    letterSpacing: 0.8,
  },
  backButton: { 
    marginTop: width > 600 ? 20 : 12, 
    alignItems: "center" 
  },
  link: { 
    fontSize: width > 600 ? 18 : 16, 
    fontWeight: "600",
    color: "#36D1DC",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
});
