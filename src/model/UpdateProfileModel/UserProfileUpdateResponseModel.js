// models/UpdateProfileModel/UserProfileUpdateResponseModel.js
import UserProfileModel from "../UserProfileModel";

class UserProfileUpdateResponseModel {
  constructor({ status = "", message = "", data = null } = {}) {
    this.status = status; // "success" | "error"
    this.message = message || "";
    this.data = data ? new UserProfileModel(data) : null;
  }

  static fromJson(json) {
    if (!json || typeof json !== "object") {
      return new UserProfileUpdateResponseModel({ status: "error", message: "", data: null });
    }

    const { status, message, data } = json;
    return new UserProfileUpdateResponseModel({
      status: status || "error",
      message: message || "",
      data: data ? new UserProfileModel(data) : null,
    });
  }
}

export default UserProfileUpdateResponseModel;
