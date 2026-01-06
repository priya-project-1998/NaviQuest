import AsyncStorage from "@react-native-async-storage/async-storage";
import UserProfileModel from "../model/UserProfileModel";

class ProfileStorage {
  static USER_PROFILE_KEY = "userProfile";

  // Store user profile
  static async storeUserProfile(userProfile) {
    try {
      if (userProfile instanceof UserProfileModel) {
        const profileJson = JSON.stringify(userProfile);
        await AsyncStorage.setItem(this.USER_PROFILE_KEY, profileJson);
        return true;
      } else {
        console.error("❌ Invalid profile data - must be UserProfileModel instance");
        return false;
      }
    } catch (error) {
      console.error("❌ Error storing user profile:", error);
      return false;
    }
  }

  // Get stored user profile
  static async getUserProfile() {
    try {
      const profileJson = await AsyncStorage.getItem(this.USER_PROFILE_KEY);
      if (profileJson) {
        const profileData = JSON.parse(profileJson);
        return new UserProfileModel(profileData);
      }
      return null;
    } catch (error) {
      console.error("❌ Error retrieving user profile:", error);
      return null;
    }
  }

  // Clear stored user profile
  static async clearUserProfile() {
    try {
      await AsyncStorage.removeItem(this.USER_PROFILE_KEY);
      return true;
    } catch (error) {
      console.error("❌ Error clearing user profile:", error);
      return false;
    }
  }
}

export default ProfileStorage;