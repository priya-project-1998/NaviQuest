import AsyncStorage from "@react-native-async-storage/async-storage";
import { postRequest, HEADER_TYPES } from "../api";
import ENDPOINTS from "../endpoints";
import LoginRequestModel from "../../model/LoginModel/LoginRequestModel";
import {RequestOtpRequestModel,ResetPasswordRequestModel} from "../../model/ForgetPasswordModel/ForgetPasswordRequestModel"
import {RequestOtpResponseModel,ResetPasswordResponseModel} from "../../model/ForgetPasswordModel/ForgetPasswordResponseModel"
import ApiResponse from "../ApiResponse";

const AuthService = {
  login: async (email, password, rememberMe) => {
    try {
      const requestModel = new LoginRequestModel(email, password);
      const response = await postRequest(
        ENDPOINTS.LOGIN,
        requestModel.toJson(),
        HEADER_TYPES.DEFAULT
      );

      // 🔹 Check backend "status" field
      if (response.status === "success" && response.data?.token) {
        // Save token & session
        await AsyncStorage.setItem("authToken", response.data.token);
        await AsyncStorage.setItem("rememberMe", rememberMe ? "true" : "false");

        const expiry = rememberMe
          ? Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days
          : Date.now() + 60 * 1000; // 1 min for testing

        await AsyncStorage.setItem("sessionExpiry", expiry.toString());

        return new ApiResponse(true, 200, response.message, response.data);
      } else {
        return new ApiResponse(false, response.code, response.message || "Login failed", response.data);
      }
    } catch (err) {
      return new ApiResponse(false, 500, err.message || "Login failed");
    }
  },

  logout: async () => {
    try {
      await AsyncStorage.multiRemove(["authToken", "rememberMe", "sessionExpiry"]);
      return new ApiResponse(true, 200, "Logged out successfully");
    } catch (err) {
      return new ApiResponse(false, 500, err.message || "Logout failed");
    }
  },

  isSessionValid: async () => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      const expiry = await AsyncStorage.getItem("sessionExpiry");
      if (!token || !expiry) return false;
      return Date.now() < parseInt(expiry, 10);
    } catch {
      return false;
    }
  },

  requestOTP: async (email) => {
    try {
      const requestModel = new RequestOtpRequestModel(email);

      const response = await postRequest(
        ENDPOINTS.REQUEST_OTP,
        requestModel.toJson(),
        HEADER_TYPES.DEFAULT
      );

      return RequestOtpResponseModel.fromJson(response);
    } catch (error) {
      return new ApiResponse("error", 500, error.message, null);
    }
  },

  resetPassword: async (email, otp, newPassword) => {
    try {
      const requestModel = new ResetPasswordRequestModel(email, otp, newPassword);

      const response = await postRequest(
        ENDPOINTS.RESET_PASSWORD,
        requestModel.toJson(),
        HEADER_TYPES.DEFAULT
      );

      return ResetPasswordResponseModel.fromJson(response);
    } catch (error) {
      return new ApiResponse("error", 500, error.message, null);
    }
  },

  deleteAccount: async () => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };
      const body = JSON.stringify({ confirm: true });

      const response = await fetch("https://rajasthanmotorsports.com/api/account/delete", {
        method: "POST",
        headers,
        body,
      });

      if (response.ok) {
        return { status: 200, message: "Account deleted successfully" };
      } else {
        const errorData = await response.json();
        return { status: response.status, message: errorData.message || "Failed to delete account" };
      }
    } catch (error) {
      return { status: 500, message: error.message || "An error occurred" };
    }
  },
};

export default AuthService;
