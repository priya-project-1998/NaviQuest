// src/model/user_register_request_model.js

export default class UserRegisterRequestModel {
  constructor(
    mobile,
    pincode,
    profile_image,
    city,
    name,
    state,
    address,
    password,
    email
  ) {
    this.mobile = mobile;
    this.pincode = pincode;
    this.profile_image = profile_image; // file path or URL
    this.city = city;
    this.name = name;
    this.state = state;
    this.address = address;
    this.password = password;
    this.email = email;
  }

  static fromJson(json) {
    if (!json) return null;
    return new UserRegisterRequestModel(
      json.mobile,
      json.pincode,
      json.profile_image,
      json.city,
      json.name,
      json.state,
      json.address,
      json.password,
      json.email
    );
  }

  toJson() {
    return {
      mobile: this.mobile,
      pincode: this.pincode,
      profile_image: this.profile_image,
      city: this.city,
      name: this.name,
      state: this.state,
      address: this.address,
      password: this.password,
      email: this.email,
    };
  }
}
