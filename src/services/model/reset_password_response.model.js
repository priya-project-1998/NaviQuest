// src/services/model/reset_password_response.model.js

export default class ResetPasswordResponseModel {
  constructor(message) {
    this.message = message;
  }

  static fromJson(json) {
    if (!json) return null;
    return new ResetPasswordResponseModel(json.message);
  }

  toJson() {
    return {
      message: this.message,
    };
  }
}
