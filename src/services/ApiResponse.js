export default class ApiResponse {
  constructor(status, code, message, data = null) {
    this.status = status || "";   // 🔹 "success" | "error"
    this.code = code || 500;      // 🔹 HTTP status code
    this.message = message || "";
    this.data = data || null;
  }

  static fromBackend(json, httpCode) {
    if (!json) return new ApiResponse("error", httpCode, "Empty response", null);

    return new ApiResponse(
      json.status || "error",
      httpCode,
      json.message || "",
      json
    );
  }
}
