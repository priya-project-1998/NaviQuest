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
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Icon from "react-native-vector-icons/Feather";
import { useFocusEffect } from "@react-navigation/native";

import SignupService from "../services/apiService/signup_service";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

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
      <Icon name={icon} size={20} color="#ccc" style={styles.icon} />
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
          <Icon name={showPassword ? "eye-off" : "eye"} size={20} color="#ccc" />
        </TouchableOpacity>
      )}
    </View>
  );

  // ---------------- Render ----------------
  return (
    <LinearGradient colors={["#0f2027", "#203a43", "#2c5364"]} style={styles.gradient}>
      <View
        style={[
          styles.card,
          { maxHeight: SCREEN_HEIGHT * 0.8, marginVertical: 20, marginHorizontal: 16 },
        ]}
      >
        <Text style={styles.title}>
          {step === "register" ? "Create Account" : "Verify OTP"}
        </Text>

        <ScrollView showsVerticalScrollIndicator={false}>
          {step === "register" && (
            <>
              {renderInput("mail", "Email (Gmail only)", email, setEmail, "email-address")}
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
        </ScrollView>

        {step === "register" ? (
          <TouchableOpacity activeOpacity={0.8} onPress={handleSignup} disabled={loading}>
            <LinearGradient colors={["#36D1DC", "#5B86E5"]} style={styles.button}>
              <Text style={styles.buttonText}>{loading ? "Signing Up..." : "Sign Up"}</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity activeOpacity={0.8} onPress={handleOtpVerify} disabled={loading}>
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

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#36D1DC" />
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1, justifyContent: "center" },
  card: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    marginHorizontal: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
    marginBottom: 24,
    letterSpacing: 1,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 10,
    marginVertical: 8,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  icon: { marginRight: 12 },
  input: { flex: 1, color: "#fff", fontSize: 16 },
  button: {
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  buttonText: { 
    color: "#fff", 
    fontWeight: "bold", 
    fontSize: 18, 
    textAlign: "center" 
  },
  link: { color: "#36D1DC", textAlign: "center", marginTop: 20, fontSize: 15 },
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
