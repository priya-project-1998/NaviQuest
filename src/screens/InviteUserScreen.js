import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Share,
  Platform,
  Dimensions,
  SafeAreaView,
  StatusBar,
  PixelRatio,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import deepLinkUtils from "../utils/deepLinkUtils";

const { width: screenWidth } = Dimensions.get("window");
const scale = screenWidth / 375;

// Responsive size helper
const normalize = (size) => {
  const newSize = size * scale;
  if (Platform.OS === 'ios') {
    return Math.round(PixelRatio.roundToNearestPixel(newSize));
  }
  return Math.round(PixelRatio.roundToNearestPixel(newSize)) - 1;
};

// Device types for responsiveness
const isSmallDevice = screenWidth < 375;
const isMediumDevice = screenWidth >= 375 && screenWidth < 415;
const isLargeDevice = screenWidth >= 415;

const InviteUserScreen = () => {
  const getAppShareMessage = () => {
    const downloadLink = Platform.OS === "ios" ? deepLinkUtils.APP_STORE_URL : deepLinkUtils.PLAY_STORE_URL;
    return `Join us on NaviQuest! Experience amazing Motorsports events in India. \nDownload here: ${downloadLink}`;
  };

  const handleShareApp = async () => {
    try {
      const appShareMessage = getAppShareMessage();
      await Share.share({
        message: appShareMessage,
        title: "Share NaviQuest",
      });
    } catch (error) {
      Alert.alert("Error", "Unable to share the app link.");
    }
  };

  return (
    // ✅ FIX 1: LinearGradient ko sabse bahar rakha hai taaki poori screen cover ho (niche ka white gap khatam)
    <LinearGradient colors={["#0f2027", "#203a43", "#2c5364"]} style={{ flex: 1 }}>
      
      {/* ✅ FIX 2: StatusBar ko transparent kiya hai taaki gradient upar tak jaye */}
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent={true}
      />

      {/* ✅ FIX 3: SafeAreaView ab gradient ke andar hai */}
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false} // iOS specific: unnecessary bounce hatane ke liye
        >
          <View style={styles.container}>
            <Text style={styles.heading}>Share NaviQuest</Text>
            <Text style={styles.subHeading}>
              Share the excitement of NaviQuest with your friends! Invite them to join and experience racing events.
            </Text>

            {/* More Share Options Button */}
            <TouchableOpacity
              onPress={handleShareApp}
              style={styles.buttonWrapper}
              activeOpacity={0.8}
            >
              <View style={styles.shareButton}>
                <LinearGradient 
                  colors={["#36D1DC", "#5B86E5"]} 
                  style={styles.shareButtonGradient}
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 0}}
                />
                <View style={styles.shareButtonContent}>
                  <Text style={styles.shareButtonText}>More Share Options</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1, // Content ko vertical center karne ke liye zaroori hai
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: isSmallDevice ? 20 : 30,
    paddingVertical: 20,
  },
  container: {
    width: "100%",
    maxWidth: 480,
    alignItems: "center",
    justifyContent: "center",
  },
  heading: {
    fontSize: isSmallDevice ? 26 : isMediumDevice ? 30 : 34,
    fontWeight: "800",
    color: "#ff7e5f", // Orange/Coral shade as per your image
    marginBottom: 15,
    textAlign: "center",
  },
  subHeading: {
    fontSize: isSmallDevice ? 14 : 16,
    color: "#ffffff",
    opacity: 0.9,
    marginBottom: 40,
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: 10,
  },
  buttonWrapper: {
    width: "90%",
    maxWidth: 320,
  },
  shareButton: {
    borderRadius: 15,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  shareButtonGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  shareButtonContent: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 18,
    letterSpacing: 0.5,
  },
});

export default InviteUserScreen;