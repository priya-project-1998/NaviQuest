// models/UserProfileModel.js
class UserProfileModel {
  constructor(data) {
    this.id = data?.id || null;
    this.name = data?.name || "";
    this.username = data?.username || "";
    this.email = data?.email || "";
    this.contact = data?.contact || "";
    this.address = data?.address || "";
    this.city = data?.city || "";
    this.state = data?.state || "";
    this.pincode = data?.pincode || "";
    this.profilePicPath = data?.profile_pic_path || null;
  }
}

export default UserProfileModel;
