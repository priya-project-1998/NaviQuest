export default class LoginRequestModel {
  constructor(email, password) {
    this.email = email || "";
    this.password = password || "";
  }

  toJson() {
    return {
      username: this.email,
      password: this.password,
    };
  }
}
