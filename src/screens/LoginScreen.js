import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, Dimensions, Platform, KeyboardAvoidingView } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import AuthService from "../services/apiService/auth_service";
import ProfileService from "../services/apiService/profile_service";
import ProfileStorage from "../utils/ProfileStorage";

const { width, height } = Dimensions.get("window");

export default function LoginScreen({ navigation }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  // 🔹 Check session on mount
  useEffect(() => {
    const checkSession = async () => {
      const isValid = await AuthService.isSessionValid();
      if (isValid) {
        navigation.replace("Drawer"); // Already logged in, redirect
      }
    };
    checkSession();
  }, []);

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert("Error", "Please enter username and password");
      return;
    }
    setLoading(true);
    const response = await AuthService.login(username, password, rememberMe);
    
    if (response.data.status === "success") {
      // Call getUserProfile after successful login
      const profileResponse = await ProfileService.getUserProfile();
      
      if (profileResponse.status && profileResponse.data) {
        // Store user profile using ProfileStorage
        await ProfileStorage.storeUserProfile(profileResponse.data);
      } else {
        console.warn("⚠️ Failed to fetch user profile after login:", profileResponse.message);
      }
      
      setLoading(false);
      navigation.replace("Drawer"); // Redirect on success
    } else {
      setLoading(false);
      Alert.alert("Login Failed", response.message || "Invalid credentials");
    }
  };

  const renderInput = (icon, placeholder, value, setValue, keyboard, secure, showToggle) => (
    <View style={styles.inputContainer}>
      <Text style={styles.iconText}>{icon}</Text>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="#aaa"
        value={value}
        onChangeText={setValue}
        keyboardType={keyboard}
        secureTextEntry={secure && !showPassword}
      />
      {showToggle && (
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
          <Text style={styles.iconText}>{showPassword ? "👁️" : "👁️‍🗨️"}</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <LinearGradient colors={["#0f2027", "#203a43", "#2c5364"]} style={styles.gradient}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="always"
        >
          <View style={styles.card}>
            <Text style={styles.title}>Login</Text>
            {renderInput("👤", "Username", username, setUsername, "default", false)}
            {renderInput("🔒", "Password", password, setPassword, "default", true, true)}

            <TouchableOpacity 
              style={styles.rememberContainer}
              onPress={() => setRememberMe(!rememberMe)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkboxBox, rememberMe && styles.checkboxBoxChecked]}>
                {rememberMe && <Text style={styles.checkboxEmoji}>✓</Text>}
              </View>
              <Text style={styles.rememberText}>Remember Me</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.8} onPress={handleLogin} disabled={loading} style={styles.buttonWrapper}>
              <LinearGradient colors={["#36D1DC", "#5B86E5"]} style={styles.button}>
                <Text style={styles.buttonText}>{loading ? "Logging in..." : "Log In"}</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate("ForgetPassword")}>
              <Text style={[styles.link, { color: "#36D1DC" }]}>Reset Password</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate("Signup")}>
              <Text style={[styles.link, { color: "#36D1DC" }]}>Don't have an account? Sign up</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { 
    flex: 1 
  },
  container: { 
    flexGrow: 1, 
    alignItems: "center",
    justifyContent: "center",
    padding: width > 600 ? 40 : 20,
    paddingVertical: width > 600 ? 50 : 40,
  },
  card: { 
    backgroundColor: "rgba(255,255,255,0.1)", 
    borderRadius: width > 600 ? 30 : 20, 
    padding: width > 600 ? 40 : 20,
    marginHorizontal: width > 600 ? 30 : 0,
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
    marginRight: 10,
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
  rememberContainer: { 
    flexDirection: "row", 
    alignItems: "center", 
    marginTop: width > 600 ? 18 : 12,
    marginBottom: width > 600 ? 15 : 10,
    paddingVertical: width > 600 ? 8 : 6,
  },
  checkboxEmoji: {
    fontSize: width > 600 ? 14 : 12,
    color: "#fff",
    fontWeight: "bold",
    textAlign: "center",
  },
  checkboxBox: {
    width: width > 600 ? 20 : 16,
    height: width > 600 ? 20 : 16,
    borderRadius: width > 600 ? 10 : 8,
    borderWidth: 2,
    borderColor: "#36D1DC",
    marginRight: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxBoxChecked: {
    backgroundColor: "#36D1DC",
  },
  rememberTouchable: {
    flex: 1,
  },
  rememberText: { 
    color: "#fff", 
    marginLeft: 0,
    fontSize: width > 600 ? 16 : 14,
  },
  button: {
    flex: 1,                    // 🔥 THIS IS THE KEY
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
    textAlign: "center", 
    marginTop: width > 600 ? 20 : 15, 
    fontSize: width > 600 ? 18 : 16,
    color: "#36D1DC",
  },
  buttonWrapper: {
  minHeight: width > 600 ? 56 : 48,
  borderRadius: width > 600 ? 16 : 12,
  marginTop: width > 600 ? 28 : 20,
  marginBottom: width > 600 ? 20 : 15,
},

});
