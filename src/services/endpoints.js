const ENDPOINTS = {
  REQUEST_OTP: "/request-otp",
  VERIFY_OTP: "/verify-register-otp",
  LOGIN: "/login",
  REGISTER: "/register",
  RESET_PASSWORD: "/reset-password",
  GET_USER_DETAIL: "/user-detail",
  GET_EVENT: "/event",
  CREATE_NEW_EVENT: "/event",
  GET_EVENT_LIST: "/events",
  GET_USER_PROFILE_DETAIL: "/user-profile",
  UPDATE_PROFILE:"/update-profile",
  GET_BANNERS: "/banners",
  
  // Join Event Endpoints
  GET_EVENT_CATEGORIES: "/events", // Will be used as: /events/{id}/categories
  GET_CATEGORY_CLASSES: "/events", // Will be used as: /events/{eventId}/categories/{categoryId}/classes
  JOIN_EVENT: "/events/join",
  
  // My Events Endpoints
  GET_MY_EVENTS: "/events/myevents",
  GET_CHECKPOINTS_PER_EVENT: "/events/checkpoints/",
  GET_CONFIG_PER_EVENT: "/events/config/",

  //Result Endpoints
  GET_PER_EVENT_RESULTS: "/events/getuser/result/"


};

export default ENDPOINTS;
