import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";

const { height: SCREEN_HEIGHT, width } = Dimensions.get("window");

import SignupService from "../services/apiService/signup_service";
import { useFocusEffect } from "@react-navigation/native";

export default function SignupScreen({ navigation }) {
  // ---------------- State ----------------
  const [step, setStep] = useState("register"); // "register" | "otp"
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [otp, setOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      resetForm();
    }, [])
  );

  const resetForm = () => {
    setStep("register");
    setEmail("");
    setName("");
    setUsername("");
    setMobile("");
    setPassword("");
    setAddress("");
    setCity("");
    setState("");
    setPincode("");
    setOtp("");
    setShowPassword(false);
  };

  // ---------------- Handlers ----------------
  const handleSignup = async () => {
    if (!email || !name || !username || !mobile || !password || !address || !city || !state || !pincode) {
      Alert.alert("Error", "Please fill all fields");
      return;
    }
    // if (!/^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(email)) {
    //   Alert.alert("Error", "Please enter a valid Gmail address");
    //   return;
    // }
    
    // ✅ Updated: general email validation (removed @gmail restriction)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Alert.alert("Error", "Please enter a valid email address");
      return;
    }
    if (!/^\d{10}$/.test(mobile)) {
      Alert.alert("Error", "Please enter a valid 10-digit mobile number");
      return;
    }
    if (password.length < 8) {
      Alert.alert("Error", "Password must be at least 8 characters long");
      return;
    }

    try {
      setLoading(true);
      const payload = { name, username, email, password, contact: mobile, address, city, state, pincode };
      const response = await SignupService.registerUser(payload);
      setLoading(false);

      if (response.status === "success") {
        Alert.alert("Success", response.message);
        setStep("otp");
      } else {
        Alert.alert("Error", response.message);
      }


    } catch (error) {
      setLoading(false);
      Alert.alert("Signup Error", "Something went wrong. Please try again.");
    }
  };

  const handleOtpVerify = async () => {
    if (!otp) {
      Alert.alert("Error", "Please enter OTP");
      return;
    }

    try {
      setLoading(true);
      const response = await SignupService.verifyOtp(email, otp);
      setLoading(false);

      if (response.status === "success") {
        Alert.alert("Success", response.message || "OTP Verified successfully");
        navigation.replace("LoginScreen");
      } else {
        Alert.alert("Error", response.message || "OTP verification failed");
      }
    } catch (error) {
      setLoading(false);
      Alert.alert("OTP Error", "Something went wrong. Please try again.");
    }
  };

  // -------- Icon mapping for emojis --------
  const iconMap = {
    mail: "📧",
    user: "👤",
    phone: "📱",
    lock: "🔒",
    home: "🏠",
    "map-pin": "📍",
    map: "🗺️",
    hash: "🔢",
    key: "🔑",
  };

  // ---------------- Input Component ----------------
  const renderInput = (
    icon,
    placeholder,
    value,
    setValue,
    keyboard,
    secure = false,
    editable = true,
    toggleSecure = false
  ) => (
    <View style={styles.inputContainer}>
      <Text style={styles.iconText}>{iconMap[icon] || icon}</Text>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="#aaa"
        value={value}
        onChangeText={setValue}
        keyboardType={keyboard}
        secureTextEntry={secure}
        editable={editable}
      />
      {toggleSecure && (
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
          <Text style={styles.iconText}>{showPassword ? "👁️" : "👁️‍🗨️"}</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // ---------------- Render ----------------
  return (
    <LinearGradient colors={["#0f2027", "#203a43", "#2c5364"]} style={styles.gradient}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={true}
          nestedScrollEnabled={true}
        >
          <View style={styles.centerContainer}>
            <View style={styles.card}>
              <Text style={styles.title}>
                {step === "register" ? "Create Account" : "Verify OTP"}
              </Text>

            {step === "register" && (
              <>
                {renderInput("mail", "Email", email, setEmail, "email-address")}
                {renderInput("user", "Full Name", name, setName, "default")}
                {renderInput("user", "Username", username, setUsername, "default")}
                {renderInput("phone", "Mobile Number", mobile, (t) => setMobile(t.replace(/[^0-9]/g, "")), "numeric")}
                {renderInput("lock", "Password", password, setPassword, "default", !showPassword, true, true)}
                {renderInput("home", "Address", address, setAddress, "default")}
                {renderInput("map-pin", "City", city, setCity, "default")}
                {renderInput("map", "State", state, setState, "default")}
                {renderInput("hash", "Pincode", pincode, setPincode, "numeric")}
              </>
            )}

            {step === "otp" && (
              <>
                {renderInput("mail", "Email", email, setEmail, "email-address", false, false)}
                {renderInput("key", "Enter OTP", otp, setOtp, "numeric")}
              </>
            )}

            {step === "register" ? (
              <TouchableOpacity activeOpacity={0.8} onPress={handleSignup} disabled={loading} style={styles.buttonWrapper}>
                <LinearGradient colors={["#36D1DC", "#5B86E5"]} style={styles.button}>
                  <Text style={styles.buttonText}>{loading ? "Signing Up..." : "Sign Up"}</Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity activeOpacity={0.8} onPress={handleOtpVerify} disabled={loading} style={styles.buttonWrapper}>
                <LinearGradient colors={["#36D1DC", "#5B86E5"]} style={styles.button}>
                  <Text style={styles.buttonText}>{loading ? "Verifying..." : "Verify OTP"}</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {step === "register" && (
              <TouchableOpacity onPress={() => navigation.replace("LoginScreen")}>
                <Text style={styles.link}>Already have an account? Log in</Text>
              </TouchableOpacity>
            )}
          </View>
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
  gradient: { 
    flex: 1 
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: width > 600 ? 40 : 20,
    paddingVertical: width > 600 ? 50 : 40,
  },
  centerContainer: {
    alignItems: "center",
    justifyContent: "flex-start",
    paddingVertical: width > 600 ? 20 : 15,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: width > 600 ? 30 : 20,
    padding: width > 600 ? 40 : 20,
    width: "100%",
    maxWidth: 500,
    alignSelf: "center",
    marginBottom: width > 600 ? 100 : 80,
  },
  title: {
    fontSize: width > 600 ? 32 : 28,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
    marginBottom: width > 600 ? 25 : 15,
    letterSpacing: 1,
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
  link: { 
    color: "#36D1DC", 
    textAlign: "center", 
    marginTop: width > 600 ? 20 : 15, 
    fontSize: width > 600 ? 18 : 16,
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
