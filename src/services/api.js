import AsyncStorage from "@react-native-async-storage/async-storage";
import ApiResponse from "./ApiResponse";

//const BASE_URL = "https://e-pickup.randomsoftsolution.in/api";
const BASE_URL = "https://rajasthanmotorsports.com/api"; //Prod URL



// 🔹 Header types
export const HEADER_TYPES = {
  DEFAULT: "default",   // Content-Type + Accept
  ACCEPT: "acceptOnly", // Accept only
  AUTH: "auth", 
  AUTH_RAW: "auth_raw", // Auth with raw body
  FORMDATA: "formData"  // multipart/form-data (no Content-Type here)
};

// 🔹 Build headers dynamically
async function buildHeaders(type, extraHeaders = {}) {
  let headers = {};

  switch (type) {
    case HEADER_TYPES.DEFAULT:
      headers["Content-Type"] = "application/json";
      headers["Accept"] = "application/json";
      break;

    case HEADER_TYPES.ACCEPT:
      headers["Accept"] = "application/json";
      break;

    case HEADER_TYPES.AUTH:
      const token = await AsyncStorage.getItem("authToken");
      if (token) {
        headers["Content-Type"] = "application/json";
        headers["Accept"] = "application/json";
        headers["Authorization"] = `Bearer ${token}`;
      } else {
        console.warn("❌ Auth token not found in AsyncStorage");
      }
      break;
    
    case HEADER_TYPES.AUTH_RAW:
      const rawToken = await AsyncStorage.getItem("authToken");
      if (rawToken) {
        headers["Accept"] = "application/json";
        headers["Authorization"] = `Bearer ${rawToken}`;
      } else {
        console.warn("❌ Auth token not found in AsyncStorage");
      }
      break;
    
    case HEADER_TYPES.FORMDATA:
      headers["Accept"] = "application/json";
      break;

    default:
      headers["Content-Type"] = "application/json";
      headers["Accept"] = "application/json";
  }

  return { ...headers, ...extraHeaders };
}

// 🔹 Generic request
async function request(
  endpoint,
  method,
  body = null,
  headerType = HEADER_TYPES.DEFAULT,
  extraHeaders = {}
) {
  try {
    const headers = await buildHeaders(headerType, extraHeaders);

    let requestBody = null;
    if (body) {
      if (headerType === HEADER_TYPES.FORMDATA) {
        requestBody = body; // direct FormData
      } else if (headerType === HEADER_TYPES.AUTH_RAW) {
        requestBody = JSON.stringify(body); // Raw JSON string for AUTH_RAW
      } else {
        requestBody = JSON.stringify(body);
      }
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers,
      body: requestBody,
    });

    const responseText = await response.text();
    let responseData;

    try {
      responseData = responseText ? JSON.parse(responseText) : null;
    } catch {
      responseData = responseText;
    }

    // 🔹 If HTTP error
    if (!response.ok) {
    
      let errorMessage =
      responseData?.detail || responseData?.message || "Request failed";
      return new ApiResponse("error", response.status, errorMessage, responseData);
    }

    // 🔹 Preserve backend "status" and "message"
    return new ApiResponse(
      responseData?.status || "success",
      response.status,
      responseData?.message || "",
      responseData
    );

  } catch (error) {
    // 🔹 Catch network / unexpected errors
    return new ApiResponse(
      "error",
      500,
      error?.message || "Network error",
      null
    );
  }
}


// ✅ Easy methods
export async function getRequest(endpoint, headerType = HEADER_TYPES.DEFAULT, extraHeaders = {}) {
  return request(endpoint, "GET", null, headerType, extraHeaders);
}

export async function postRequest(endpoint, body, headerType = HEADER_TYPES.DEFAULT, extraHeaders = {}) {
  return request(endpoint, "POST", body, headerType, extraHeaders);
}
