// src/services/model/verify_otp_response.model.js

export default class VerifyOtpResponseModel {
  constructor(message = null, detail = null) {
    this.message = message;
    this.detail = detail;
  }

  static fromJson(json) {
    if (!json) return null;
    return new VerifyOtpResponseModel(json.message || null, json.detail || null);
  }

  toJson() {
    return {
      message: this.message,
      detail: this.detail,
    };
  }

  isSuccess() {
    return this.message !== null;
  }

  isFailure() {
    return this.detail !== null;
  }
}
