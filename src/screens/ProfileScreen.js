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
  Animated,
  Dimensions,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Icon from "react-native-vector-icons/MaterialIcons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import ProfileService from "../services/apiService/profile_service";
import ProfileStorage from "../utils/ProfileStorage";
import { pickImage } from "../utils/ImagePicker";

export default function ProfileScreen() {
  const navigation = useNavigation();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateVal, setStateVal] = useState("");
  const [pincode, setPincode] = useState("");
  const [loading, setLoading] = useState(false);
  // Local-only avatar state (UI only, no API change)
  const [avatarUri, setAvatarUri] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedImageFilename, setSelectedImageFilename] = useState(null);

  // 🔹 Fetch profile every time screen is focused
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
          // Try to show profile pic if provided by API (no logic change)
          if (user.profilePicPath) {
            setAvatarUri(user.profilePicPath);
          } else if (user.profile_pic_url) {
            setAvatarUri(user.profile_pic_url);
          } else if (user.profile_pic) {
            setAvatarUri(`https://rajasthanmotorsports.com/assets/app/profile/${user.profile_pic}`);
          }
        }
      };

      fetchProfile();
    }, [])
  );

  // 🔹 Pick image (UI only). No API changes here
  const handlePickImage = async () => {
    try {
      const img = await pickImage();
      if (img) {
        setAvatarUri(img.uri);
        setSelectedImage(img);
        // Extract filename from URI
        const uriParts = img.uri.split('/');
        const filename = uriParts[uriParts.length - 1];
        setSelectedImageFilename(filename);
        // Debug log for image selection
        console.log('[DEBUG] Picked image URI:', img.uri);
        console.log('[DEBUG] Picked image filename:', filename);
      }
    } catch (e) {
      Alert.alert("Image Picker", e?.toString() || "Unable to pick image");
    }
  };

  // 🔹 Update Profile API
  const handleUpdateProfile = async () => {
    if (!name || !mobile || !address || !city || !stateVal || !pincode) {
      Alert.alert("Error", "Please fill all editable fields");
      return;
    }

    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 5000));
    // Use FormData for image upload
    const formData = new FormData();
    formData.append('name', String(name));
    formData.append('contact', String(mobile));
    formData.append('address', String(address));
    formData.append('city', String(city));
    formData.append('state', String(stateVal));
    formData.append('pincode', String(pincode));
    if (selectedImage && selectedImage.uri) {
      formData.append('profile_pic', {
        uri: selectedImage.uri,
        type: selectedImage.type || 'image/jpeg',
        name: selectedImageFilename,
      });
    }

    try {
      const res = await ProfileService.updateUserProfile(formData, true);
      setLoading(false);

      if (res.status && res.data) {
        Alert.alert("Success", res.message || "Profile updated successfully");
        const user = res.data;
        setName(user.name);
        setUsername(user.username);
        setMobile(user.contact);
        setEmail(user.email);
        setAddress(user.address);
        setCity(user.city);
        setStateVal(user.state);
        setPincode(user.pincode);
        if (user.profilePicPath) {
          setAvatarUri(user.profilePicPath);
        } else if (user.profile_pic_url) {
          setAvatarUri(user.profile_pic_url);
        } else if (user.profile_pic) {
          setAvatarUri(`https://rajasthanmotorsports.com/assets/app/profile/${user.profile_pic}`);
        }
        setSelectedImage(null);
        setSelectedImageFilename(null);
        // Fetch latest profile from API and store for drawer
        const latestProfileRes = await ProfileService.getUserProfile();
        if (latestProfileRes && latestProfileRes.data) {
          ProfileStorage.storeUserProfile(latestProfileRes.data);
          // Debug log for latest profile image
          console.log('[DEBUG] Latest profile image:', latestProfileRes.data.profilePicPath, latestProfileRes.data.profile_pic_url, latestProfileRes.data.profile_pic);
          // Update screen state from latest profile
          const latestUser = latestProfileRes.data;
          setName(latestUser.name);
          setUsername(latestUser.username);
          setMobile(latestUser.contact);
          setEmail(latestUser.email);
          setAddress(latestUser.address);
          setCity(latestUser.city);
          setStateVal(latestUser.state);
          setPincode(latestUser.pincode);
          if (latestUser.profilePicPath) {
            setAvatarUri(latestUser.profilePicPath);
          } else if (latestUser.profile_pic_url) {
            setAvatarUri(latestUser.profile_pic_url);
          } else if (latestUser.profile_pic) {
            setAvatarUri(`https://rajasthanmotorsports.com/assets/app/profile/${latestUser.profile_pic}`);
          }
          // Remove forced drawer open/close logic
        }
      } else {
        console.log('[DEBUG] API Error Response:', res);
        Alert.alert("Error", res.message || "Profile update failed");
      }
    } catch (err) {
      setLoading(false);
      console.log('[DEBUG] Network Error:', err);
      Alert.alert("Network Error", err?.message || "Network request failed");
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Header with Enhanced Background */}
      <LinearGradient colors={["#0f2027", "#203a43", "#2c5364"]} style={styles.header}>

        {/* Header Title */}
        {/* <View style={styles.headerTitle}>
          <Icon name="settings" size={24} color="#fff" />
        </View> */}

        {/* Background Pattern */}
        <View style={styles.backgroundPattern}>
          <View style={[styles.circle, styles.circle1]} />
          <View style={[styles.circle, styles.circle2]} />
          <View style={[styles.circle, styles.circle3]} />
        </View>
        
        <View style={styles.profileImageContainer}>
          <TouchableOpacity onPress={handlePickImage} style={styles.imageWrapper} activeOpacity={0.8}>
            <View style={styles.profileImageBorder}>
              <Image
                source={
                  avatarUri
                    ? { uri: avatarUri }
                    : require("../assets/images/profile-placeholder.png")
                }
                style={styles.profileImage}
              />
            </View>
            <View style={styles.editIconContainer}>
              <LinearGradient colors={["#36D1DC", "#5B86E5"]} style={styles.editIconGradient}>
                <Text style={styles.cameraIconText}>📷</Text>
              </LinearGradient>
            </View>
          </TouchableOpacity>
          <Text style={styles.profileName}>{name || username || 'Your Name'}</Text>
          <Text style={styles.profileEmail}>{email}</Text>
          <View style={styles.profileStats}>
            <View style={styles.statItem}>
              <Text style={styles.statEmoji}>🗓</Text>
              <Text style={styles.statText}>{city || 'Add City'}</Text>
            </View>
            <View style={[styles.statItem, {marginLeft: 8}]}> 
              <Text style={styles.statEmoji}>📧</Text>
              <Text style={styles.statText}>{email ? 'Verified' : 'Not verified'}</Text>
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
          {/* Personal Information Section */}
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
            
            <ModernInput
              label="Full Name"
              value={name}
              onChangeText={setName}
            />

            <ModernInput
              label="Mobile Number"
              value={mobile}
              onChangeText={(text) => setMobile(text.replace(/[^0-9]/g, ""))}
              keyboardType="numeric"
              maxLength={10}
            />
          </View>

          {/* Address Information Section */}
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
                <ModernInput
                  label="City"
                  value={city}
                  onChangeText={setCity}
                  emoji="🏙️"
                />
              </View>
              <View style={styles.halfInput}>
                <ModernInput
                  label="State"
                  value={stateVal}
                  onChangeText={setStateVal}
                  emoji="🗺️"
                />
              </View>
            </View>

            <ModernInput
              label="Pincode"
              value={pincode}
              onChangeText={(text) => setPincode(text.replace(/[^0-9]/g, ""))}
              emoji="📮"
              keyboardType="numeric"
              maxLength={6}
            />

            <ModernInput
              label="Address"
              value={address}
              onChangeText={setAddress}
              emoji="🏠"
              multiline={true}
              numberOfLines={3}
            />
          </View>

          {/* Update Button */}
          <TouchableOpacity 
            style={styles.updateButton} 
            onPress={handleUpdateProfile}
            activeOpacity={0.8}
          >
            <LinearGradient 
              colors={["#36D1DC", "#5B86E5"]} 
              style={styles.updateButtonGradient}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 0}}
            >
              <Text style={styles.updateButtonText}>Update Profile</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.bottomSpacing} />
        </ScrollView>
      )}
    </View>
  );
}

// 🔹 Enhanced Modern Input Component
const ModernInput = ({ label, editable = true, multiline = false, numberOfLines = 1, ...props }) => (
  <View style={styles.inputContainer}>
    <Text style={styles.inputLabel}>{label}</Text>
    <View style={[
      styles.inputWrapper,
      !editable && styles.disabledInput,
      multiline && styles.multilineInput
    ]}>
      <TextInput
        style={[
          styles.textInput,
          !editable && styles.disabledText,
          multiline && styles.multilineText
        ]}
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

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f2027',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 25, // Reduced from 40
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    position: 'relative',
    overflow: 'hidden',
  },
  headerTitle: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 65 : 45,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  headerTitleText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 20,
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
  },
  cameraIconText: {
    fontSize: 16,
    color: '#fff',
  },
  backgroundPattern: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  circle: {
    position: 'absolute',
    borderRadius: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  circle1: {
    width: 200,
    height: 200,
    top: -50,
    right: -50,
  },
  circle2: {
    width: 150,
    height: 150,
    top: 20,
    left: -30,
  },
  circle3: {
    width: 100,
    height: 100,
    bottom: -20,
    right: 50,
  },
  profileImageContainer: {
    alignItems: 'center',
    zIndex: 2,
  },
  imageWrapper: {
    position: 'relative',
    marginBottom: 10, // Reduced from 15
  },
  profileImageBorder: {
    width: 110, // Reduced from 130
    height: 110, // Reduced from 130
    borderRadius: 55, // Reduced from 65
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 4, // Reduced from 5
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 15,
  },
  profileImage: {
    width: 102, // Reduced from 120
    height: 102, // Reduced from 120
    borderRadius: 51, // Reduced from 60
  },
  editIconContainer: {
    position: 'absolute',
    bottom: 3, // Reduced from 5
    right: 3, // Reduced from 5
    borderRadius: 16, // Reduced from 18
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  editIconGradient: {
    width: 32, // Reduced from 36
    height: 32, // Reduced from 36
    borderRadius: 16, // Reduced from 18
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: {
    fontSize: 22, // Reduced from 26
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4, // Reduced from 5
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  profileEmail: {
    fontSize: 14, // Reduced from 16
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 8, // Reduced from 10
  },
  profileStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10, // Reduced from 12
    paddingVertical: 4, // Reduced from 6
    borderRadius: 12, // Reduced from 15
  },
  statText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 11, // Reduced from 12
    fontWeight: '500',
    marginLeft: 4,
  },
  statEmoji: {
    fontSize: 11, // Reduced from 12
    marginRight: 2,
  },
  formContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingTop: 25,
    paddingBottom: 30,
  },
  sectionContainer: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: 25,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
  },
  sectionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(54, 209, 220, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  sectionEmoji: {
    fontSize: 18,
  },
  sectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(54, 209, 220, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sectionBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#36D1DC',
    marginLeft: 4,
  },
  badgeEmoji: {
    fontSize: 10,
    marginRight: 2,
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfInput: {
    width: '48%',
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
    marginLeft: 5,
  },
  inputWrapper: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 15,
    paddingHorizontal: 20,
    minHeight: 55,
    justifyContent: 'center',
  },
  multilineInput: {
    paddingVertical: 15,
    minHeight: 85,
    justifyContent: 'flex-start',
  },
  disabledInput: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  textInput: {
    fontSize: 16,
    color: '#fff',
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    width: '100%',
  },
  multilineText: {
    paddingVertical: 8,
    textAlignVertical: 'top',
  },
  disabledText: {
    color: 'rgba(255,255,255,0.6)',
  },
  updateButton: {
    marginTop: 10,
    marginHorizontal: 20,
    borderRadius: 15,
    overflow: 'hidden',
    shadowColor: '#36D1DC',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  updateButtonGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 25,
  },
  buttonIcon: {
    marginRight: 10,
  },
  updateButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f2027',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#36D1DC',
    fontWeight: '600',
  },
  bottomSpacing: {
    height: 30,
  },
});
