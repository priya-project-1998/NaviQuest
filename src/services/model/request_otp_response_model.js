// C:\Project\VCMApp\src\services\model\request_otp_response_model.js

export default class RequestOtpResponseModel {
  constructor(message) {
    this.message = message;
  }

  // Factory method to create model from API JSON
  static fromJson(json) {
    return new RequestOtpResponseModel(json?.message ?? '');
  }

  // Convert back to JSON (if needed)
  toJson() {
    return {
      message: this.message,
    };
  }
}
