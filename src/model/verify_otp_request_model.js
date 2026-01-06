// src/model/verify_otp_request_model.js

export default class VerifyOtpRequestModel {
  constructor(email, otp) {
    this.email = email;
    this.otp = otp;
  }

  static fromJson(json) {
    if (!json) return null;
    return new VerifyOtpRequestModel(json.email, json.otp);
  }

  toJson() {
    return {
      email: this.email,
      otp: this.otp,
    };
  }
}
