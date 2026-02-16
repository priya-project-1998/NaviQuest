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

const { width } = Dimensions.get("window");

const StepIndicator = React.memo(({ number, label, active }) => (
  <View style={styles.stepContainer}>
    <View style={active ? styles.activeStepCircleBg : styles.inactiveStepCircle}>
      <Text style={styles.stepNumber}>{number}</Text>
    </View>
    <Text style={[styles.stepLabel, active && { color: "#4facfe" }]}>{label}</Text>
  </View>
));

export default function ForgetPasswordScreen({ navigation }) {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const iconMap = { mail: "📧", key: "🔑", lock: "🔒" };

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
        Alert.alert("OTP Sent", "Check your email for OTP", [
          { text: "OK", onPress: () => setStep(2) },
        ]);
      } else {
        Alert.alert("Error", response.message || "Failed to send OTP");
      }
    } catch (err) {
      setLoading(false);
      Alert.alert("Error", "Something went wrong");
    }
  };

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
        Alert.alert("Success", "Password reset successfully", [
          { text: "OK", onPress: () => navigation.navigate("LoginScreen") },
        ]);
      } else {
        Alert.alert("Error", response.message || "Failed to reset password");
      }
    } catch (err) {
      setLoading(false);
      Alert.alert("Error", "Something went wrong");
    }
  };

  return (
    <LinearGradient colors={["#0f2027", "#203a43", "#2c5364"]} style={styles.gradient}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={styles.container} bounces={false}>
          <View style={styles.card}>
            <Text style={styles.title}>Reset Password</Text>

            {/* Stepper */}
            <View style={styles.stepperRow}>
              <StepIndicator number="1" label="OTP" active={step === 1} />
              <View style={styles.stepLine} />
              <StepIndicator number="2" label="Reset" active={step === 2} />
            </View>

            {/* Step 1 & 2 common: Email Input */}
            <View style={[styles.inputContainer, step === 2 && { backgroundColor: "rgba(255,255,255,0.1)" }]}>
              <Text style={styles.iconText}>{iconMap.mail}</Text>
              <TextInput
                style={[styles.input, step === 2 && { color: "#888" }]}
                placeholder="Enter Email"
                placeholderTextColor="#aaa"
                value={email}
                onChangeText={setEmail}
                editable={step === 1}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* Step 1 Button */}
            {step === 1 && (
              <TouchableOpacity activeOpacity={0.8} onPress={handleRequestOtp} disabled={loading} style={styles.buttonWrapper}>
                <LinearGradient colors={["#36D1DC", "#5B86E5"]} style={styles.button}>
                  <Text style={styles.buttonText}>{loading ? "Sending..." : "Request OTP"}</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {/* Step 2 Content - No Conditional Rendering to avoid iOS background glitch */}
            <View style={{ display: step === 2 ? 'flex' : 'none' }}>
              <View style={styles.inputContainer}>
                <Text style={styles.iconText}>{iconMap.key}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter OTP"
                  placeholderTextColor="#aaa"
                  keyboardType="numeric"
                  value={otp}
                  onChangeText={setOtp}
                  textContentType="oneTimeCode"
                />
              </View>

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
            </View>

            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Text style={styles.link}>Back to Login</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
  gradient: { flex: 1 },
  container: { flexGrow: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  card: { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 20, padding: 20, width: "100%", maxWidth: 400 },
  title: { fontSize: 26, fontWeight: "bold", color: "#fff", textAlign: "center", marginBottom: 20 },
  stepperRow: { flexDirection: "row", alignItems: "center", marginBottom: 25, justifyContent: 'center' },
  stepContainer: { alignItems: "center", width: 70 },
  activeStepCircleBg: { width: 35, height: 35, borderRadius: 17.5, backgroundColor: "#4facfe", justifyContent: "center", alignItems: "center", marginBottom: 5 },
  inactiveStepCircle: { width: 35, height: 35, borderRadius: 17.5, borderWidth: 1, borderColor: "#fff", justifyContent: "center", alignItems: "center", marginBottom: 5 },
  stepNumber: { color: "#fff", fontWeight: "bold" },
  stepLabel: { color: "#ccc", fontSize: 10 },
  stepLine: { height: 1, width: 50, backgroundColor: "#fff", marginHorizontal: 10 },
  inputContainer: { 
    flexDirection: "row", 
    alignItems: "center", 
    backgroundColor: "rgba(255,255,255,0.2)", 
    borderRadius: 12, 
    marginVertical: 10, 
    paddingHorizontal: 12, 
    height: 55,
    borderWidth: Platform.OS === 'ios' ? 0.5 : 0,
    borderColor: 'rgba(255,255,255,0.3)'
  },
  iconText: { fontSize: 20, marginRight: 10 },
  input: { flex: 1, color: "#fff", fontSize: 16 },
  buttonWrapper: { height: 50, borderRadius: 12, marginTop: 15, overflow: 'hidden' },
  button: { flex: 1, justifyContent: "center", alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  backButton: { marginTop: 20, alignItems: "center" },
  link: { color: "#36D1DC", fontWeight: "600" },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", zIndex: 999 }
});