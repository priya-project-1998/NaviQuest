export class RequestOtpRequestModel {
  constructor(email) {
    this.email = email;
  }

  toJson() {
    return {
      email: this.email,
    };
  }
}

export class ResetPasswordRequestModel {
  constructor(email, otp, newPassword) {
    this.email = email;
    this.otp = otp;
    this.new_password = newPassword;
  }

  toJson() {
    return {
      email: this.email,
      otp: this.otp,
      new_password: this.new_password,
    };
  }
}
