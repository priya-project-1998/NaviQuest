// models/signup/SignupRequestModel.js

// 🔹 Register Request Model
class RegisterRequestModel {
  constructor({ name, username, email, password, contact, address, city, state, pincode }) {
    this.name = name || "";
    this.username = username || "";
    this.email = email || "";
    this.password = password || "";
    this.contact = contact || "";
    this.address = address || "";
    this.city = city || "";
    this.state = state || "";
    this.pincode = pincode || "";
  }

  toJson() {
    return {
      name: this.name,
      username: this.username,
      email: this.email,
      password: this.password,
      contact: this.contact,
      address: this.address,
      city: this.city,
      state: this.state,
      pincode: this.pincode,
    };
  }
}

// 🔹 Verify OTP Request Model
class VerifyOtpModel {
  constructor(email, otp) {
    this.email = email || "";
    this.otp = otp || "";
  }

  toJson() {
    return { email: this.email, otp: this.otp };
  }
}

export { RegisterRequestModel, VerifyOtpModel };
