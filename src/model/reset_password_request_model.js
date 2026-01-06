// src/model/reset_password_request_model.js

export default class ResetPasswordRequestModel {
  constructor(email, new_password) {
    this.email = email;
    this.new_password = new_password;
  }

  static fromJson(json) {
    if (!json) return null;
    return new ResetPasswordRequestModel(json.email, json.new_password);
  }

  toJson() {
    return {
      email: this.email,
      new_password: this.new_password,
    };
  }
}
