// ProfileScreen.js
// FINAL MERGED VERSION
// iOS button fix + Android UI consistency
// Logic unchanged, API unchanged, design preserved

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
  Dimensions,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Icon from "react-native-vector-icons/MaterialIcons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import ProfileService from "../services/apiService/profile_service";
import ProfileStorage from "../utils/ProfileStorage";
import { pickImage } from "../utils/ImagePicker";

const { width } = Dimensions.get("window");

export default function ProfileScreen() {

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateVal, setStateVal] = useState("");
  const [pincode, setPincode] = useState("");
  const [loading, setLoading] = useState(false);

  const [avatarUri, setAvatarUri] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedImageFilename, setSelectedImageFilename] = useState(null);

  // Fetch profile
  useFocusEffect(
    useCallback(() => {
      const fetchProfile = async () => {
        setLoading(true);
        const res = await ProfileService.getUserProfile();
        setLoading(false);

        if (res && res.data) {
          const user = res.data;
          setName(user.name);
          setUsername(user.username);
          setMobile(user.contact);
          setEmail(user.email);
          setAddress(user.address);
          setCity(user.city);
          setStateVal(user.state);
          setPincode(user.pincode);

          if (user.profilePicPath) setAvatarUri(user.profilePicPath);
          else if (user.profile_pic_url) setAvatarUri(user.profile_pic_url);
          else if (user.profile_pic)
            setAvatarUri(`https://rajasthanmotorsports.com/assets/app/profile/${user.profile_pic}`);
        }
      };

      fetchProfile();
    }, [])
  );

  // Pick image
  const handlePickImage = async () => {
    try {
      const img = await pickImage();
      if (img) {
        setAvatarUri(img.uri);
        setSelectedImage(img);
        const uriParts = img.uri.split("/");
        const filename = uriParts[uriParts.length - 1];
        setSelectedImageFilename(filename);
      }
    } catch (e) {
      Alert.alert("Image Picker", e?.toString() || "Unable to pick image");
    }
  };

  // Update profile
  const handleUpdateProfile = async () => {
    if (!name || !mobile || !address || !city || !stateVal || !pincode) {
      Alert.alert("Error", "Please fill all editable fields");
      return;
    }

    setLoading(true);

    const formData = new FormData();
    formData.append("name", String(name));
    formData.append("contact", String(mobile));
    formData.append("address", String(address));
    formData.append("city", String(city));
    formData.append("state", String(stateVal));
    formData.append("pincode", String(pincode));

    if (selectedImage && selectedImage.uri) {
      formData.append("profile_pic", {
        uri: selectedImage.uri,
        type: selectedImage.type || "image/jpeg",
        name: selectedImageFilename,
      });
    }

    try {
      const res = await ProfileService.updateUserProfile(formData, true);
      setLoading(false);

      if (res.status && res.data) {
        Alert.alert("Success", res.message || "Profile updated successfully");

        const latestProfileRes = await ProfileService.getUserProfile();
        if (latestProfileRes && latestProfileRes.data) {
          ProfileStorage.storeUserProfile(latestProfileRes.data);
        }
      } else {
        Alert.alert("Error", res.message || "Profile update failed");
      }
    } catch (err) {
      setLoading(false);
      Alert.alert("Network Error", err?.message || "Network request failed");
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* HEADER */}
      <LinearGradient colors={["#0f2027", "#203a43", "#2c5364"]} style={styles.header}>
        <View style={styles.backgroundPattern}>
          <View style={[styles.circle, styles.circle1]} />
          <View style={[styles.circle, styles.circle2]} />
          <View style={[styles.circle, styles.circle3]} />
        </View>

        <View style={styles.profileImageContainer}>
          <TouchableOpacity onPress={handlePickImage} style={styles.imageWrapper} activeOpacity={0.8}>
            <View style={styles.profileImageBorder}>
              <Image
                source={avatarUri ? { uri: avatarUri } : require("../assets/images/profile-placeholder.png")}
                style={styles.profileImage}
              />
            </View>
            <View style={styles.editIconContainer}>
              <LinearGradient colors={["#36D1DC", "#5B86E5"]} style={styles.editIconGradient}>
                <Text style={styles.cameraIconText}>📷</Text>
              </LinearGradient>
            </View>
          </TouchableOpacity>

          <Text style={styles.profileName}>{name || username || "Your Name"}</Text>
          <Text style={styles.profileEmail}>{email}</Text>

          <View style={styles.profileStats}>
            <View style={styles.statItem}>
              <Text style={styles.statEmoji}>📍</Text>
              <Text style={styles.statText}>{city || "Add City"}</Text>
            </View>
            <View style={[styles.statItem, { marginLeft: 8 }]}>
              <Text style={styles.statEmoji}>📧</Text>
              <Text style={styles.statText}>{email ? "Verified" : "Not verified"}</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#36D1DC" />
          <Text style={styles.loadingText}>Updating your profile...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.formContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          {/* PERSONAL INFO */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconContainer}>
                <Text style={styles.sectionEmoji}>👤</Text>
              </View>
              <Text style={styles.sectionTitle}>Personal Information</Text>
              <View style={styles.sectionBadge}>
                <Text style={styles.badgeEmoji}>✏️</Text>
                <Text style={styles.sectionBadgeText}>Editable</Text>
              </View>
            </View>

            <ModernInput label="Full Name" value={name} onChangeText={setName} />

            <ModernInput
              label="Mobile Number"
              value={mobile}
              onChangeText={(text) => setMobile(text.replace(/[^0-9]/g, ""))}
              keyboardType="numeric"
              maxLength={10}
            />
          </View>

          {/* ADDRESS */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconContainer}>
                <Text style={styles.sectionEmoji}>📍</Text>
              </View>
              <Text style={styles.sectionTitle}>Address Information</Text>
              <View style={styles.sectionBadge}>
                <Text style={styles.badgeEmoji}>🗺️</Text>
                <Text style={styles.sectionBadgeText}>Location</Text>
              </View>
            </View>

            <View style={styles.inputRow}>
              <View style={styles.halfInput}>
                <ModernInput label="City" value={city} onChangeText={setCity} />
              </View>
              <View style={styles.halfInput}>
                <ModernInput label="State" value={stateVal} onChangeText={setStateVal} />
              </View>
            </View>

            <ModernInput
              label="Pincode"
              value={pincode}
              onChangeText={(text) => setPincode(text.replace(/[^0-9]/g, ""))}
              keyboardType="numeric"
              maxLength={6}
            />

            <ModernInput
              label="Address"
              value={address}
              onChangeText={setAddress}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* UPDATE BUTTON (FIXED iOS) */}
          <View style={styles.updateButtonContainer}>
            <TouchableOpacity onPress={handleUpdateProfile} activeOpacity={0.85} style={styles.updateTouchable}>
              <LinearGradient colors={["#36D1DC", "#5B86E5"]} style={styles.updateButtonGradient}>
                <Text style={styles.updateButtonText}>Update Profile</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <View style={styles.bottomSpacing} />
        </ScrollView>
      )}
    </View>
  );
}

// INPUT COMPONENT
const ModernInput = ({ label, editable = true, multiline = false, numberOfLines = 1, ...props }) => (
  <View style={styles.inputContainer}>
    <Text style={styles.inputLabel}>{label}</Text>
    <View
      style={[
        styles.inputWrapper,
        !editable && styles.disabledInput,
        multiline && styles.multilineInput,
      ]}
    >
      <TextInput
        style={[styles.textInput, !editable && styles.disabledText, multiline && styles.multilineText]}
        placeholderTextColor="#aaa"
        editable={editable}
        multiline={multiline}
        numberOfLines={multiline ? numberOfLines : 1}
        textAlignVertical={multiline ? "top" : "center"}
        {...props}
      />
    </View>
  </View>
);

// STYLES
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f2027" },

  header: {
    paddingTop: Platform.OS === "ios" ? 0 : 32,
    paddingBottom: 22,
    alignItems: "center",
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    position: "relative",
    overflow: "hidden",
    height: "35%"
  },

  backgroundPattern: { position: "absolute", width: "100%", height: "100%" },

  circle: { position: "absolute", borderRadius: 100, backgroundColor: "rgba(255,255,255,0.1)" },
  circle1: { width: 200, height: 200, top: -50, right: -50 },
  circle2: { width: 150, height: 150, top: 20, left: -30 },
  circle3: { width: 100, height: 100, bottom: -20, right: 50 },

  profileImageContainer: { alignItems: "center", zIndex: 2, paddingTop: 28 },

  imageWrapper: { position: "relative", marginBottom: 10 },

  profileImageBorder: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "rgba(255,255,255,0.2)",
    padding: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 15,
  },

  profileImage: { width: 102, height: 102, borderRadius: 51 },

  editIconContainer: {
    position: "absolute",
    bottom: 3,
    right: 3,
    borderRadius: 16,
    overflow: "hidden",
    elevation: 8,
  },

  editIconGradient: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },

  cameraIconText: { fontSize: 16, color: "#fff" },

  profileName: { fontSize: 22, fontWeight: "bold", color: "#fff", marginBottom: 4 },
  profileEmail: { fontSize: 14, color: "rgba(255,255,255,0.9)", marginBottom: 8 },

  profileStats: { flexDirection: "row", alignItems: "center" },

  statItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },

  statText: { color: "rgba(255,255,255,0.9)", fontSize: 11, fontWeight: "500", marginLeft: 4 },
  statEmoji: { fontSize: 11, marginRight: 2 },

  formContainer: { flex: 1, paddingHorizontal: 20 },

  scrollContent: { paddingTop: 22, paddingBottom: 28 },

  sectionContainer: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 20,
    padding: 22,
    marginBottom: 18,
    elevation: 6,
  },

  sectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 18 },

  sectionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(54,209,220,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  sectionTitle: { fontSize: 18, fontWeight: "bold", color: "#fff", flex: 1 },
  sectionEmoji: { fontSize: 18 },

  sectionBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(54,209,220,0.2)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },

  sectionBadgeText: { fontSize: 11, fontWeight: "500", color: "#36D1DC", marginLeft: 4 },
  badgeEmoji: { fontSize: 10, marginRight: 2 },

  inputRow: { flexDirection: "row", justifyContent: "space-between" },
  halfInput: { width: "48%" },

  inputContainer: { marginBottom: 18 },

  inputLabel: { fontSize: 14, fontWeight: "600", color: "#fff", marginBottom: 8, marginLeft: 5 },

  inputWrapper: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    borderRadius: 15,
    paddingHorizontal: 20,
    minHeight: 55,
    justifyContent: "center",
  },

  multilineInput: { paddingVertical: 15, minHeight: 85, justifyContent: "flex-start" },

  textInput: { fontSize: 16, color: "#fff", paddingVertical: Platform.OS === "ios" ? 10 : 8, width: "100%" },

  multilineText: { paddingVertical: 8, textAlignVertical: "top" },

  disabledInput: { borderColor: "rgba(255,255,255,0.2)" },
  disabledText: { color: "rgba(255,255,255,0.6)" },

  /* BUTTON FIX STRUCTURE */
  updateButtonContainer: { marginTop: 10, marginHorizontal: 20 },

  updateTouchable: {
    height: 54,
    borderRadius: 15,
    overflow: "hidden",
    elevation: 8,
  },

  updateButtonGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  updateButtonText: { fontSize: 16, fontWeight: "bold", color: "#fff", letterSpacing: 0.5 },

  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0f2027" },

  loadingText: { marginTop: 15, fontSize: 16, color: "#36D1DC", fontWeight: "600" },

  bottomSpacing: { height: 30 },
});
