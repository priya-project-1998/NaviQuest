export default class EventModel {
  constructor(data) {
    this.id = data?.id ?? "";
    this.name = data?.event_name ?? "Untitled Event";
    this.venue = data?.event_venue ?? "-";
    this.desc = data?.event_desc ?? "";
    this.startDate = data?.event_start_date ?? "";
    this.endDate = data?.event_end_date ?? "";
    this.organisedBy = data?.event_organised_by ?? "-";
    
    // Process image URLs - prepend base URL if needed
    this.pic = this.processImageUrl(data?.event_pic);
    this.headerImg = this.processImageUrl(data?.event_header_img);
    this.footerImg = this.processImageUrl(data?.event_footer_img);
    
    this.createdDate = data?.created_date ?? "";
    this.modifyDate = data?.modify_date ?? "";
    this.isDeleted = data?.is_deleted === "1";

    // Derived property
    this.isCompleted = this.checkIfCompleted();
  }

  processImageUrl(imagePath) {
    if (!imagePath) return null;
    
    // If the path already starts with http:// or https://, return as is
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    
    // If it's a relative path, prepend the base URL
    // const BASE_URL = "https://e-pickup.randomsoftsolution.in";
    const BASE_URL = "https://rajasthanmotorsports.com";

    const fullUrl = `${BASE_URL}/${imagePath}`;
    
    return fullUrl;
  }

  checkIfCompleted() {
    if (!this.endDate) return false;
    const now = new Date();
    const end = new Date(this.endDate.replace(" ", "T")); // fix format
    return end < now;
  }
}
