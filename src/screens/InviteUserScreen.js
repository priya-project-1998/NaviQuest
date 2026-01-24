import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Share,
  Platform,
  Linking,
  Dimensions,
  SafeAreaView,
  StatusBar,
  useWindowDimensions,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import deepLinkUtils from "../utils/deepLinkUtils";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

// Determine device type
const isSmallDevice = screenWidth < 375;
const isMediumDevice = screenWidth >= 375 && screenWidth < 415;
const isLargeDevice = screenWidth >= 415;

const InviteUserScreen = () => {
  const getAppShareMessage = () => {
    const downloadLink = Platform.OS === "ios" ? deepLinkUtils.APP_STORE_URL : deepLinkUtils.PLAY_STORE_URL;
    return `Join us on NaviQuest! Experience amazing Motorsports events in India. \nDownload here: ${downloadLink}`;
  };

  const handleShareViaWhatsApp = async () => {
    try {
      const appShareMessage = getAppShareMessage();
      const url = `whatsapp://send?text=${encodeURIComponent(appShareMessage)}`;
      const canOpen = await Linking.canOpenURL(url);
      
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert("Error", "WhatsApp is not installed on this device.");
      }
    } catch (error) {
      Alert.alert("Error", "Unable to open WhatsApp.");
    }
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
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar
        barStyle={Platform.OS === "ios" ? "light-content" : "light-content"}
        backgroundColor="transparent"
        translucent={Platform.OS === "android"}
      />
      <LinearGradient colors={["#0f2027", "#203a43", "#2c5364"]} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={true}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            <Text style={styles.heading}>Share NaviQuest</Text>
            <Text style={styles.subHeading}>
              Share the excitement of NaviQuest with your friends! Invite them to join and experience racing events.
            </Text>

            {/* WhatsApp Share Button */}
            <TouchableOpacity
              onPress={handleShareViaWhatsApp}
              style={styles.buttonWrapper}
              activeOpacity={0.7}
            >
              <LinearGradient colors={["#25D366", "#20BA5C"]} style={styles.shareButton}>
                <Text style={styles.shareButtonText}>Share via WhatsApp</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* More Share Options Button */}
            <TouchableOpacity
              onPress={handleShareApp}
              style={styles.buttonWrapper}
              activeOpacity={0.7}
            >
              <LinearGradient colors={["#36D1DC", "#5B86E5"]} style={styles.shareButton}>
                <Text style={styles.shareButtonText}>More Share Options</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: isSmallDevice ? 12 : 16,
    paddingVertical: isSmallDevice ? 12 : isLargeDevice ? 20 : 16,
  },
  container: {
    width: "100%",
    maxWidth: 480,
    alignItems: "center",
    justifyContent: "center",
  },
  heading: {
    fontSize: isSmallDevice ? 24 : isMediumDevice ? 28 : 32,
    fontWeight: "700",
    color: "#ff7e5f",
    marginBottom: isSmallDevice ? 8 : 12,
    textAlign: "center",
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
  subHeading: {
    fontSize: isSmallDevice ? 13 : isMediumDevice ? 15 : 16,
    color: "#fff",
    marginBottom: isSmallDevice ? 20 : isMediumDevice ? 24 : 28,
    textAlign: "center",
    lineHeight: isSmallDevice ? 20 : 24,
    paddingHorizontal: 8,
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
  buttonWrapper: {
    width: "100%",
    marginTop: isSmallDevice ? 10 : 12,
    paddingHorizontal: 12,
  },
  shareButton: {
    paddingVertical: isSmallDevice ? 12 : isMediumDevice ? 14 : 16,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    minHeight: isSmallDevice ? 48 : 52,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 3,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  shareButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: isSmallDevice ? 13 : isMediumDevice ? 15 : 16,
    textAlign: "center",
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
});

export default InviteUserScreen;
