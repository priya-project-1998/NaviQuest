// ---------------- Login User Data ----------------
export class LoginUserData {
  constructor({ id, username, email }) {
    this.id = id || "";
    this.username = username || "";
    this.email = email || "";
  }

  static fromJson(json) {
    if (!json) return null;
    return new LoginUserData({
      id: json.id,
      username: json.username,
      email: json.email,
    });
  }
}

// ---------------- Login Response ----------------
export default class LoginResponseModel {
  constructor({ status, message, token, data }) {
    this.status = status || "error";
    this.message = message || "";
    this.access_token = token || "";
    this.data = data ? LoginUserData.fromJson(data) : null;
  }

  static fromJson(json) {
    if (!json) return new LoginResponseModel({});
    return new LoginResponseModel({
      status: json.status,
      message: json.message,
      token: json.token,
      data: json.data,
    });
  }
}
