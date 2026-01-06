// services/apiService/signup_service.js
import ApiResponse from "../ApiResponse";
import { HEADER_TYPES, postRequest } from "../api"; 
import { RegisterRequestModel, VerifyOtpModel } from "../../model/SignupModel/SignupRequestModels";
import {
  RegisterResponseModel,
  VerifyOtpResponseModel,
} from "../../model/SignupModel/SignupResponseModels";
import ENDPOINTS from "../endpoints";


const SignupService = {
  // 🔹 Register user
  registerUser: async (payload) => {
    try {
      const requestModel = new RegisterRequestModel(payload);

      const response = await postRequest(ENDPOINTS.REGISTER,requestModel.toJson(), HEADER_TYPES.DEFAULT);

      return RegisterResponseModel.fromJson(response);
    } catch (error) {
      return new ApiResponse(false, 500, error.message, null);
    }
  },

  // 🔹 Verify OTP
  verifyOtp: async (email, otp) => {
    try {
      const requestModel = new VerifyOtpModel(email, otp);

      const response = await postRequest(ENDPOINTS.VERIFY_OTP,requestModel.toJson(), HEADER_TYPES.DEFAULT);

      return VerifyOtpResponseModel.fromJson(response);
    } catch (error) {
      return new ApiResponse(false, 500, error.message, null);
    }
  },
};

export default SignupService;
