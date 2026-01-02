// models/UpdateProfileModel/UserProfileUpdateRequestModel.js
class UserProfileUpdateRequestModel {
  constructor({ name, contact, address, city, state, pincode, profile_pic }) {
    this.name = name || "";
    this.contact = contact || "";
    this.address = address || "";
    this.city = city || "";
    this.state = state || "";
    this.pincode = pincode || "";
    this.profile_pic = profile_pic || "";
  }

  toJson() {
    return {
      name: this.name,
      contact: this.contact,
      address: this.address,
      city: this.city,
      state: this.state,
      pincode: this.pincode,
      profile_pic: this.profile_pic,
    };
  }
}

export default UserProfileUpdateRequestModel;
