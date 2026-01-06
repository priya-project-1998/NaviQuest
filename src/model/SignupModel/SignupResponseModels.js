// ---------------- Register User Data ----------------
class RegisterUserData {
  constructor({
    name,
    username,
    email,
    contact,
    address,
    city,
    state,
    pincode,
    otp,
    profile_pic_path,
    profile_pic_url,
  } = {}) {
    this.name = name || "";
    this.username = username || "";
    this.email = email || "";
    this.contact = contact || "";
    this.address = address || "";
    this.city = city || "";
    this.state = state || "";
    this.pincode = pincode || "";
    this.otp = otp || null;
    this.profilePicPath = profile_pic_path || null;
    this.profilePicUrl = profile_pic_url || null;
  }

  static fromJson(json) {
    if (!json || typeof json !== "object") return null;
    return new RegisterUserData(json);
  }
}

// ---------------- Register Response ----------------
class RegisterResponseModel {
  constructor({ status = "", message = "", data = null } = {}) {
    this.status = status;   // "success" | "error"
    this.message = message || "";
    this.data = data ? RegisterUserData.fromJson(data) : null;
  }

  static fromJson(json) {
    if (!json || typeof json !== "object") {
      return new RegisterResponseModel({ status: "error", message: "", data: null });
    }

    const { status, message, ...rest } = json;
    const data = status === "success" ? RegisterUserData.fromJson(rest) : null;

    return new RegisterResponseModel({
      status: status || "error",
      message: message || "",
      data,
    });
  }
}

// ---------------- Verify OTP Response ----------------
class VerifyOtpResponseModel {
  constructor({ status = "", message = "" } = {}) {
    this.status = status;   // "success" | "error"
    this.message = message || "";
  }

  static fromJson(json) {
    if (!json || typeof json !== "object") {
      return new VerifyOtpResponseModel({ status: "error", message: "" });
    }

    return new VerifyOtpResponseModel({
      status: json.status || "error",
      message: json.message || "",
    });
  }
}

export { RegisterUserData, RegisterResponseModel, VerifyOtpResponseModel };
