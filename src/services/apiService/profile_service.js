import { postRequest } from "../api";
import ENDPOINTS from "../endpoints";
import ApiResponse from "../ApiResponse";
import { HEADER_TYPES } from "../api";
import UserProfileModel from "../../model/UserProfileModel";
import UserProfileUpdateRequestModel from "../../model/UpdateProfileModel/UserProfileUpdateRequestModel";
import AsyncStorage from "@react-native-async-storage/async-storage";

class ProfileService {
  // 🔹 Get User Profile (unchanged)
  async getUserProfile() {
    try {
      const res = await postRequest(
        ENDPOINTS.GET_USER_PROFILE_DETAIL,
        null,
        HEADER_TYPES.AUTH
      );

      const userObj = res?.data?.user || null;

      if (res.status === "success" && userObj) {
        const userProfile = new UserProfileModel(userObj);
        return new ApiResponse(true, 200, "Profile fetched successfully", userProfile);
      } else {
        return new ApiResponse(false, res.code || 500, res.message || "Failed to fetch profile", null);
      }
    } catch (err) {
      return new ApiResponse(false, 500, err.message || "Fetching profile failed", null);
    }
  }

  // 🔹 Update User Profile (fixed)
  async updateUserProfile(updateData, isMultipart = false) {
    try {
      let requestBody = updateData;
      let headerType = HEADER_TYPES.AUTH;
      let token = await AsyncStorage.getItem("authToken");
      let extraHeaders = {};
      if (token) {
        extraHeaders["Authorization"] = `Bearer ${token}`;
      }
      if (isMultipart) {
        // Use FORMDATA header type for FormData
        headerType = HEADER_TYPES.FORMDATA;
      } else {
        requestBody = new UserProfileUpdateRequestModel(updateData).toJson();
      }

      const res = await postRequest(
        ENDPOINTS.UPDATE_PROFILE,
        requestBody,
        headerType,
        extraHeaders
      );

      const userObj = res?.data?.user || null;

      if ((res.status === "success" || res.success === true) && userObj) {
        const updatedProfile = new UserProfileModel(userObj);
        return new ApiResponse(true, 200, res.message || "Profile updated successfully", updatedProfile);
      } else {
        return new ApiResponse(false, res.code || 500, res.message || "Profile update failed", null);
      }
    } catch (err) {
      return new ApiResponse(false, 500, err.message || "Profile update failed", null);
    }
  }
}

export default new ProfileService();
