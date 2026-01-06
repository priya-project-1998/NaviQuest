export class RequestOtpResponseModel {
  constructor(status, message, otp = null) {
    this.status = status;
    this.message = message;
    this.otp = otp; 
  }

  static fromJson(json) {
    return new RequestOtpResponseModel(
      json?.status || "error",
      json?.message || "",
      json?.otp || null
    );
  }
}

export class ResetPasswordResponseModel {
  constructor(status, message) {
    this.status = status;
    this.message = message;
  }

  static fromJson(json) {
    return new ResetPasswordResponseModel(
      json?.status || "error",
      json?.message || ""
    );
  }
}
